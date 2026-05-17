import os
import time
from datetime import datetime, timezone, timedelta
from prefect import flow, task
from scrapers.scraper_teket import ScraperTeket
from scrapers.scraper_eplus import ScraperEplus
from scrapers.scraper_pia import ScraperPia
from scrapers.scraper_lawson import ScraperLawson
from scrapers.scraper_peatix import ScraperPeatix
from scrapers.scraper_livepocket import ScraperLivepocket
from processor.claude_extractor import extract_event, extract_event_from_image, extract_game_titles
from processor.web_enricher import enrich_event_fields
from validator.machine_validator import validate
from images.processor import process_event_image, image_storage_key
from utils.db import get_client
from utils.notify import notify_failure, notify_success
from utils.config import IGDB_CLIENT_ID, IGDB_CLIENT_SECRET
from utils.entity_resolution import (
    extract_hard_keys,
    find_existing_event,
    find_existing_event_by_name_date,
    find_or_create_organizer,
    save_game_titles,
    save_external_ids,
    save_event_source,
    merge_fields,
)

FLOW_NAME = "minstrel-collect"


@task
def scrape_teket() -> list[dict]:
    return ScraperTeket().scrape()


@task
def scrape_eplus() -> list[dict]:
    return ScraperEplus().scrape()


@task
def scrape_pia() -> list[dict]:
    return ScraperPia().scrape()


@task
def scrape_lawson() -> list[dict]:
    return ScraperLawson().scrape()


@task
def scrape_peatix() -> list[dict]:
    return ScraperPeatix().scrape()


@task
def scrape_livepocket() -> list[dict]:
    return ScraperLivepocket().scrape()



@task
def extract_events(raw_events: list[dict]) -> list[dict]:
    results = []
    skipped_not_game = 0
    pre_parsed_count = 0

    for raw in raw_events:
        # ── 複数公演（_pre_parsed_list）の展開 ───────────────────────────
        pre_list = raw.get("_pre_parsed_list")
        if pre_list:
            content = raw.get("raw_html") or raw.get("raw_text") or ""
            gt_result = extract_game_titles(content, raw.get("source_url", ""))
            if not gt_result.get("is_game_music_event", True):
                skipped_not_game += 1
                continue
            for pre in pre_list:
                if not (pre.get("title") and pre.get("start_datetime")):
                    continue
                pre["source_rank"]    = raw.get("source_rank", "A")
                pre["_image_url"]     = raw.get("image_url")
                pre["_source_name"]   = raw.get("source_name", "unknown")
                # 各公演の source_url（フラグメント付き）を _raw_source_url に設定
                pre["_raw_source_url"] = pre.get("source_url", raw.get("source_url", ""))
                if raw.get("_organizer_x_url"):
                    pre["_organizer_x_url"] = raw["_organizer_x_url"]
                pre["game_titles"] = gt_result["game_titles"]
                pre["game_music_reason"] = gt_result.get("game_music_reason", "")
                results.append(pre)
                pre_parsed_count += 1
            continue

        # ── 構造化済みデータがある場合は Claude をスキップ ──────────────
        pre = raw.get("_pre_parsed")
        if pre and pre.get("title") and pre.get("start_datetime"):
            pre["source_rank"] = raw.get("source_rank", "A")
            pre["_image_url"] = raw.get("image_url")
            pre["_source_name"] = raw.get("source_name", "unknown")
            pre["_raw_source_url"] = raw.get("source_url", "")
            if raw.get("ticket_url") and not pre.get("ticket_url"):
                pre["ticket_url"] = raw["ticket_url"]
            if raw.get("_organizer_x_url"):
                pre["_organizer_x_url"] = raw["_organizer_x_url"]
            # ゲームタイトルは常に Claude で抽出（キーワードマッチを使わない）
            content = raw.get("raw_html") or raw.get("raw_text") or ""
            gt_result = extract_game_titles(content, raw.get("source_url", ""))
            if not gt_result.get("is_game_music_event", True):
                skipped_not_game += 1
                continue
            pre["game_titles"] = gt_result["game_titles"]
            pre["game_music_reason"] = gt_result.get("game_music_reason", "")
            results.append(pre)
            pre_parsed_count += 1
            continue

        content = raw.get("raw_html") or raw.get("raw_text") or ""
        if not content:
            continue

        source_name = raw.get("source_name", "")
        is_x_source = source_name in ("x_search", "x_monitored", "x_followed")

        # X ソース: Pattern 1（URLページ）/ Pattern 2（フライヤーVision）で抽出
        if is_x_source:
            flyer_image_url = raw.get("_flyer_image_url")
            tweet_text = raw.get("_tweet_text", content)
            has_page_content = raw.get("_has_page_content", False)

            if has_page_content:
                # Pattern 1: ページ内容から厳格フィルターで抽出
                extracted = extract_event(content, raw.get("source_url", ""), strict=True)
            elif flyer_image_url:
                # Pattern 2: フライヤー画像をVisionで読み取り
                extracted = extract_event_from_image(flyer_image_url, tweet_text, raw.get("source_url", ""))
            else:
                continue  # スクレイパーで弾かれるはずだが念のため
        else:
            extracted = extract_event(content, raw.get("source_url", ""))

        if extracted:
            if not extracted.get("is_game_music_event", True):
                skipped_not_game += 1
                continue
            extracted["source_rank"] = raw.get("source_rank", "C")
            extracted["_image_url"] = raw.get("image_url") or raw.get("_flyer_image_url")
            extracted["_source_name"] = source_name
            extracted["_raw_source_url"] = raw.get("source_url", "")
            if raw.get("ticket_url") and not extracted.get("ticket_url"):
                extracted["ticket_url"] = raw["ticket_url"]
            if raw.get("_organizer_x_url"):
                extracted["_organizer_x_url"] = raw["_organizer_x_url"]
            if raw.get("_author_handle"):
                extracted["_author_handle"] = raw["_author_handle"]
            if is_x_source:
                extracted["_tweet_text"] = raw.get("_tweet_text", "")
            results.append(extracted)

    if skipped_not_game:
        print(f"[extract] skipped {skipped_not_game} non-game-music events")
    if pre_parsed_count:
        print(f"[extract] pre-parsed (Claude skipped): {pre_parsed_count} items")
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
        author_handle = event.pop("_author_handle", "")

        if not source_url:
            continue

        organizer_x_url = event.pop("_organizer_x_url", None)
        organizer_official_url = event.pop("organizer_official_url", None)

        # ── step 1: source_url が既存なら完全重複 → スキップ ──────────────
        # save_event_source が False を返したら既処理
        hard_keys = extract_hard_keys(event)

        # ── step 2: ハードキーで既存 event を検索 ──────────────────────────
        existing_event_id = find_existing_event(db, hard_keys)

        # ── step 2b: ファジーマッチ（同名 + 同日 [+ オーガナイザー]）────────
        if not existing_event_id:
            # オーガナイザーを先行ルックアップ（作成はせず ID のみ取得）
            org_name = (event.get("organizer_name") or "").strip()
            organizer_id_hint: str | None = None
            if org_name:
                org_res = (
                    db.table("organizers")
                    .select("id")
                    .eq("name", org_name)
                    .limit(1)
                    .execute()
                )
                if org_res.data:
                    organizer_id_hint = org_res.data[0]["id"]

            existing_event_id = find_existing_event_by_name_date(
                db,
                event.get("title"),
                event.get("start_datetime"),
                organizer_id=organizer_id_hint,
            )

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
                print(f"[db] skip: 必須項目不足 title={bool(event_name)} date={bool(start_dt)} url={source_url[:60]}")
                continue

            ticket_url = event.get("ticket_url")
            confidence = event.get("confidence_score")
            organizer_id = find_or_create_organizer(
                db,
                event.get("organizer_name"),
                x_url=organizer_x_url,
                official_url=organizer_official_url,
            )
            row = {
                "event_name": event_name,
                "start_datetime": start_dt,
                "venue_name": event.get("venue"),
                "prefecture": event.get("prefecture"),
                "description": event.get("description"),
                "organizer_id": organizer_id,
                "source_url": source_url,
                "source_rank": event.get("source_rank", "C"),
                "confidence_score": (
                    int(confidence * 100) if isinstance(confidence, float)
                    else int(confidence) if confidence is not None
                    else None
                ),
                "auto_publish_eligible": event.get("auto_publish_eligible", False),
                "is_canceled": event.get("is_cancelled", False),
                "is_published": event.get("auto_publish_eligible", False),
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
            save_game_titles(db, new_event_id, event.get("game_titles") or [])
            inserted += 1

    print(f"[db] inserted={inserted}, merged={merged}")
    return inserted


@task
def auto_enrich() -> int:
    """直近のスクレイピングで作成された未公開イベントの不足フィールドをウェブ検索で補完する。"""
    db = get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    result = db.table("events").select(
        "id, event_name, venue_name, prefecture, organizers(name)"
    ).eq("is_published", False).gte("created_at", cutoff).execute()

    events = result.data or []
    if not events:
        print("[enrich] No recently created unpublished events to enrich")
        return 0

    enriched = 0
    for event in events:
        needs_venue = not event.get("venue_name")
        needs_pref  = not event.get("prefecture")

        if not needs_venue and not needs_pref:
            continue

        organizer = ""
        if isinstance(event.get("organizers"), dict):
            organizer = event["organizers"].get("name", "")

        print(f"[enrich] enriching: {event['event_name'][:50]}")
        enriched_data = enrich_event_fields(event["event_name"], organizer)
        if not enriched_data:
            continue

        updates = {}
        if needs_venue and enriched_data.get("venue_name"):
            updates["venue_name"] = enriched_data["venue_name"]
        if needs_pref and enriched_data.get("prefecture"):
            updates["prefecture"] = enriched_data["prefecture"]
        if updates:
            db.table("events").update(updates).eq("id", event["id"]).execute()
            enriched += 1
            print(f"[enrich] done: {event['event_name'][:40]} fields={list(updates.keys())}")

    print(f"[enrich] enriched {enriched} / {len(events)} events")
    return enriched


@task
def fetch_missing_igdb_covers() -> int:
    """igdb_cover_url が未設定のゲームタイトルにカバー画像を付与する。"""
    if not IGDB_CLIENT_ID or not IGDB_CLIENT_SECRET:
        print("[igdb] IGDB_CLIENT_ID / IGDB_CLIENT_SECRET 未設定のためスキップ")
        return 0

    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from scripts.fetch_igdb_covers import get_token, search_cover, build_search_candidates
    import time

    db = get_client()
    result = db.table("game_titles").select("id, title_name, english_name, igdb_cover_url").execute()
    pending = [t for t in (result.data or []) if not t.get("igdb_cover_url")]

    if not pending:
        print("[igdb] カバー画像取得不要（すべて設定済み）")
        return 0

    print(f"[igdb] 未取得タイトル: {len(pending)} 件")
    token = get_token()
    found = 0
    for title in pending:
        candidates = build_search_candidates(title["title_name"], title.get("english_name"))
        url = None
        for query in candidates:
            try:
                url = search_cover(query, token)
                time.sleep(0.25)
            except Exception as e:
                print(f"[igdb] error for {title['title_name']}: {e}")
                break
            if url:
                break
        if url:
            db.table("game_titles").update({"igdb_cover_url": url}).eq("id", title["id"]).execute()
            found += 1

    print(f"[igdb] 取得完了: {found} / {len(pending)} 件")
    return found


@task
def fetch_ticket_sale_dates() -> int:
    """ticket_sale_start が未設定の公開済みイベントの発売日を source_url からスクレイピングする。"""
    from processor.ticket_sale_fetcher import fetch_ticket_sale_date

    db = get_client()
    result = (
        db.table("events")
        .select("id, source_url")
        .eq("is_published", True)
        .is_("ticket_sale_start", "null")
        .not_.is_("source_url", "null")
        .execute()
    )

    events = [
        e for e in (result.data or [])
        if e.get("source_url") and not e["source_url"].startswith("screenshot:")
    ]
    if not events:
        print("[ticket_sale] No events to process")
        return 0

    print(f"[ticket_sale] Processing {len(events)} events")
    updated = 0
    for event in events:
        sale_date = fetch_ticket_sale_date(event["source_url"])
        if sale_date:
            db.table("events").update({"ticket_sale_start": sale_date}).eq("id", event["id"]).execute()
            print(f"[ticket_sale] {event['id'][:8]} → {sale_date}")
            updated += 1
        time.sleep(0.5)

    print(f"[ticket_sale] updated {updated} / {len(events)} events")
    return updated


@task
def fetch_ticket_sale_dates_from_x() -> int:
    """X（Twitter）の監視アカウント投稿からチケット発売日を取得してDBを更新する。"""
    from processor.ticket_sale_fetcher import fetch_ticket_sale_dates_from_x as _fetch
    return _fetch()


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
        raw_teket = scrape_teket()
        raw_eplus = scrape_eplus()
        raw_pia = scrape_pia()
        raw_lawson = scrape_lawson()
        raw_peatix = scrape_peatix()
        raw_livepocket = scrape_livepocket()
        raw = raw_teket + raw_eplus + raw_pia + raw_lawson + raw_peatix + raw_livepocket
        scraped_count = len(raw)
        print(
            f"scraped: teket={len(raw_teket)}, "
            f"eplus={len(raw_eplus)}, pia={len(raw_pia)}, lawson={len(raw_lawson)}, "
            f"peatix={len(raw_peatix)}, livepocket={len(raw_livepocket)}, total={scraped_count}"
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

        enrich_count = auto_enrich()
        print(f"auto-enriched: {enrich_count} events")

        igdb_count = fetch_missing_igdb_covers()
        print(f"igdb covers fetched: {igdb_count}")

        ticket_sale_count = fetch_ticket_sale_dates()
        print(f"ticket sale dates fetched (source_url): {ticket_sale_count}")

        ticket_sale_x_count = fetch_ticket_sale_dates_from_x()
        print(f"ticket sale dates fetched (X): {ticket_sale_x_count}")

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
