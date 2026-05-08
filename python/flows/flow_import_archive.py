"""
過去データ一括投入フロー（4-B）

2083WEB の過去アーカイブを収集→構造化→検証→DB投入する。
通常の collect_flow と同じパイプラインを使い、
allow_past=True で過去日付のイベントも eligible にする。

実行:
  cd python
  PYTHONPATH="." .venv/Scripts/python flows/flow_import_archive.py
  PYTHONPATH="." .venv/Scripts/python flows/flow_import_archive.py --max-pages 5
"""
import argparse
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from prefect import flow, task

from scrapers.scraper_2083web_archive import Scraper2083WebArchive
from processor.claude_extractor import extract_event
from validator.machine_validator import validate
from images.processor import process_event_image, image_storage_key
from utils.db import get_client


@task
def scrape_archive(max_pages: int) -> list[dict]:
    scraper = Scraper2083WebArchive()
    events = scraper.scrape(max_pages=max_pages)
    print(f"[archive] scraped: {len(events)} events")
    return events


@task
def extract_events(raw_events: list[dict]) -> list[dict]:
    results = []
    for i, raw in enumerate(raw_events, 1):
        print(f"[extract] {i}/{len(raw_events)} {raw['source_url']}")
        extracted = extract_event(raw.get("raw_html", ""), raw.get("source_url", ""))
        if extracted:
            extracted["source_rank"] = raw.get("source_rank", "B")
            extracted["_image_url"] = raw.get("image_url")
            results.append(extracted)
    print(f"[extract] extracted: {len(results)}/{len(raw_events)}")
    return results


@task
def validate_events(events: list[dict]) -> list[dict]:
    # allow_past=True: 過去日付を past_event 扱いしない
    return [validate(e, allow_past=True) for e in events]


@task
def process_images(events: list[dict]) -> list[dict]:
    for event in events:
        raw_url = event.pop("_image_url", None)
        if not raw_url:
            continue
        key = image_storage_key(raw_url)
        public_url = process_event_image(raw_url, key)
        if public_url:
            event["flyer_image_url"] = public_url
    return events


@task
def upsert_to_db(events: list[dict]) -> int:
    db = get_client()
    count = 0
    for event in events:
        event_name = event.get("title") or ""
        start_dt = event.get("start_datetime") or ""
        if not event_name or not start_dt:
            continue

        ticket_url = event.get("ticket_url")
        row = {
            "event_name": event_name,
            "start_datetime": start_dt,
            "venue_name": event.get("venue"),
            "prefecture": event.get("prefecture"),
            "description": event.get("description"),
            "source_url": event.get("source_url"),
            "source_rank": event.get("source_rank", "B"),
            "confidence_score": int(event["confidence_score"] * 100) if event.get("confidence_score") is not None else None,
            "auto_publish_eligible": event.get("auto_publish_eligible", False),
            "is_canceled": event.get("is_cancelled", False),
            "is_published": event.get("auto_publish_eligible", False),
            "flyer_image_url": event.get("flyer_image_url"),
        }
        if ticket_url:
            row["ticket_urls"] = {"primary": ticket_url}

        try:
            # source_url で重複チェックしてなければ insert
            existing = (
                db.table("events")
                .select("id")
                .eq("source_url", row["source_url"])
                .execute()
            )
            if existing.data:
                continue
            db.table("events").insert(row).execute()
            count += 1
        except Exception as e:
            print(f"[upsert] error: {e} — {event_name}")

    print(f"[upsert] inserted: {count} new events")
    return count


@flow(name="minstrel-import-archive", log_prints=True)
def import_archive_flow(max_pages: int = 20):
    raw = scrape_archive(max_pages)
    extracted = extract_events(raw)
    validated = validate_events(extracted)
    with_images = process_images(validated)
    count = upsert_to_db(with_images)
    print(f"[import_archive] done. {count} events inserted.")
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-pages", type=int, default=20,
                        help="巡回するリストページの最大数（デフォルト: 20）")
    args = parser.parse_args()
    import_archive_flow(max_pages=args.max_pages)
