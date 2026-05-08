from datetime import datetime, timezone
from prefect import flow, task
from scrapers.scraper_2083web import Scraper2083Web
from scrapers.scraper_teket import ScraperTeket
from scrapers.scraper_x_search import scrape_x_search
from processor.claude_extractor import extract_event, score_announcement
from validator.machine_validator import validate
from images.processor import process_event_image, image_storage_key
from utils.db import get_client
from utils.notify import notify_failure, notify_success
from utils.entity_resolution import (
    extract_hard_keys,
    find_existing_event,
    save_external_ids,
    save_event_source,
    merge_fields,
)

FLOW_NAME = "minstrel-collect"


@task
def scrape_2083web() -> list[dict]:
    return Scraper2083Web().scrape()


@task
def scrape_teket() -> list[dict]:
    return ScraperTeket().scrape()


@task
def scrape_x(since_days: int = 3) -> list[dict]:
    return scrape_x_search(since_days=since_days)


ANNOUNCEMENT_SCORE_THRESHOLD = 70  # X ツイートの告知確度足切り閾値


@task
def extract_events(raw_events: list[dict]) -> list[dict]:
    results = []
    skipped_low_score = 0

    for raw in raw_events:
        content = raw.get("raw_html") or raw.get("raw_text") or ""
        if not content:
            continue

        # X ツイートは告知確度スコアで足切り（API コスト削減）
        if raw.get("source_name") == "x_search":
            score = score_announcement(content)
            if score < ANNOUNCEMENT_SCORE_THRESHOLD:
                skipped_low_score += 1
                continue

        extracted = extract_event(content, raw.get("source_url", ""))
        if extracted:
            extracted["source_rank"] = raw.get("source_rank", "B")
            extracted["_image_url"] = raw.get("image_url")
            extracted["_source_name"] = raw.get("source_name", "unknown")
            extracted["_raw_source_url"] = raw.get("source_url", "")
            # ticket_url がスクレイパーから直接提供されている場合は優先使用
            if raw.get("ticket_url") and not extracted.get("ticket_url"):
                extracted["ticket_url"] = raw["ticket_url"]
            results.append(extracted)

    if skipped_low_score:
        print(f"[extract] skipped {skipped_low_score} low-score X tweets")
    return results


@task
def validate_events(events: list[dict]) -> list[dict]:
    return [validate(e) for e in events]


@task
def process_images(events: list[dict]) -> list[dict]:
    for event in events:
        raw_image_url = event.pop("_image_url", None)
        if not raw_image_url:
            continue
        key = image_storage_key(raw_image_url)
        public_url = process_event_image(raw_image_url, key)
        if public_url:
            event["flyer_image_url"] = public_url
    return events


@task
def upsert_to_db(events: list[dict]) -> int:
    db = get_client()
    inserted = 0
    merged = 0

    for event in events:
        source_url = event.get("_raw_source_url") or event.get("source_url") or ""
        source_name = event.pop("_source_name", "unknown")
        event.pop("_raw_source_url", None)

        if not source_url:
            continue

        # ── step 1: source_url が既存なら完全重複 → スキップ ──────────────
        # save_event_source が False を返したら既処理
        hard_keys = extract_hard_keys(event)

        # ── step 2: ハードキーで既存 event を検索 ──────────────────────────
        existing_event_id = find_existing_event(db, hard_keys)

        if existing_event_id:
            # 既存イベントに補完マージ
            existing = (
                db.table("events")
                .select("id, flyer_image_url, ticket_urls, confidence_score")
                .eq("id", existing_event_id)
                .single()
                .execute()
            )
            updates = merge_fields(existing.data or {}, event, source_name)
            if updates:
                db.table("events").update(updates).eq("id", existing_event_id).execute()
                merged += 1

            recorded = save_event_source(
                db, source_url, source_name, event, existing_event_id, "matched"
            )
            if not recorded:
                continue  # 既に処理済み

            save_external_ids(db, existing_event_id, hard_keys)

        else:
            # 新規イベントとして作成
            event_name = event.get("title") or ""
            start_dt = event.get("start_datetime") or None
            if not event_name or not start_dt:
                # 必須項目が欠けている場合は source のみ保存して review へ
                save_event_source(db, source_url, source_name, event, None, "review_needed")
                continue

            ticket_url = event.get("ticket_url")
            confidence = event.get("confidence_score")
            row = {
                "event_name": event_name,
                "start_datetime": start_dt,
                "venue_name": event.get("venue"),
                "prefecture": event.get("prefecture"),
                "description": event.get("description"),
                "source_url": source_url,
                "source_rank": event.get("source_rank", "B"),
                "confidence_score": (
                    int(confidence * 100) if isinstance(confidence, float)
                    else int(confidence) if confidence is not None
                    else None
                ),
                "auto_publish_eligible": event.get("auto_publish_eligible", False),
                "is_canceled": event.get("is_cancelled", False),
                "is_published": False,
                "flyer_image_url": event.get("flyer_image_url"),
            }
            if ticket_url:
                row["ticket_urls"] = {"primary": ticket_url}

            result = db.table("events").insert(row).execute()
            if not result.data:
                continue

            new_event_id = result.data[0]["id"]
            recorded = save_event_source(
                db, source_url, source_name, event, new_event_id, "matched"
            )
            if not recorded:
                # source_url が既存（別ルートで登録済み） → 今作った event を削除
                db.table("events").delete().eq("id", new_event_id).execute()
                continue

            save_external_ids(db, new_event_id, hard_keys)
            inserted += 1

    print(f"[db] inserted={inserted}, merged={merged}")
    return inserted


def _log_run(
    started_at: datetime,
    status: str,
    scraped: int = 0,
    inserted: int = 0,
    error: str | None = None,
) -> None:
    try:
        get_client().table("pipeline_runs").insert({
            "flow_name": FLOW_NAME,
            "started_at": started_at.isoformat(),
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "scraped_count": scraped,
            "inserted_count": inserted,
            "error_message": error,
        }).execute()
    except Exception as e:
        print(f"[log] failed to record run: {e}")


@flow(name=FLOW_NAME, log_prints=True)
def collect_flow():
    started_at = datetime.now(timezone.utc)
    scraped_count = 0
    inserted_count = 0
    try:
        raw_2083 = scrape_2083web()
        raw_teket = scrape_teket()
        raw_x = scrape_x(since_days=3)
        raw = raw_2083 + raw_teket + raw_x
        scraped_count = len(raw)
        print(
            f"scraped: 2083web={len(raw_2083)}, teket={len(raw_teket)}, "
            f"x={len(raw_x)}, total={scraped_count}"
        )

        extracted = extract_events(raw)
        print(f"extracted: {len(extracted)} items")

        validated = validate_events(extracted)
        print(f"validated: {len(validated)} items")

        with_images = process_images(validated)
        image_count = sum(1 for e in with_images if e.get("flyer_image_url"))
        print(f"images processed: {image_count} items")

        inserted_count = upsert_to_db(with_images)
        print(f"inserted: {inserted_count} new events")

        _log_run(started_at, "success", scraped_count, inserted_count)
        notify_success(FLOW_NAME, scraped_count, inserted_count)

    except Exception as e:
        error_msg = str(e)
        print(f"[error] {error_msg}")
        _log_run(started_at, "failed", scraped_count, inserted_count, error_msg)
        notify_failure(FLOW_NAME, error_msg)
        raise


if __name__ == "__main__":
    collect_flow()
