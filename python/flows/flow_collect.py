from datetime import datetime, timezone
from prefect import flow, task
from scrapers.scraper_2083web import Scraper2083Web
from processor.claude_extractor import extract_event
from validator.machine_validator import validate
from images.processor import process_event_image, image_storage_key
from utils.db import get_client
from utils.notify import notify_failure, notify_success

FLOW_NAME = "minstrel-collect"


@task
def scrape_2083web() -> list[dict]:
    return Scraper2083Web().scrape()


@task
def extract_events(raw_events: list[dict]) -> list[dict]:
    results = []
    for raw in raw_events:
        extracted = extract_event(
            raw.get("raw_html", ""),
            raw.get("source_url", ""),
        )
        if extracted:
            extracted["source_rank"] = raw.get("source_rank", "B")
            extracted["_image_url"] = raw.get("image_url")
            results.append(extracted)
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
    count = 0
    for event in events:
        event_name = event.get("title") or ""
        start_dt = event.get("start_datetime") or ""
        existing = (
            db.table("events")
            .select("id")
            .eq("event_name", event_name)
            .eq("start_datetime", start_dt)
            .execute()
        )
        if existing.data:
            continue
        ticket_url = event.get("ticket_url")
        row = {
            "event_name": event_name,
            "start_datetime": start_dt or None,
            "venue_name": event.get("venue"),
            "prefecture": event.get("prefecture"),
            "description": event.get("description"),
            "source_url": event.get("source_url"),
            "source_rank": event.get("source_rank", "B"),
            "confidence_score": int(event["confidence_score"] * 100) if event.get("confidence_score") is not None else None,
            "auto_publish_eligible": event.get("auto_publish_eligible", False),
            "is_canceled": event.get("is_cancelled", False),
            "is_published": False,
            "flyer_image_url": event.get("flyer_image_url"),
        }
        if ticket_url:
            row["ticket_urls"] = {"primary": ticket_url}
        db.table("events").insert(row).execute()
        count += 1
    return count


def _log_run(started_at: datetime, status: str, scraped: int = 0,
             inserted: int = 0, error: str | None = None) -> None:
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
        raw = scrape_2083web()
        scraped_count = len(raw)
        print(f"scraped: {scraped_count} items")

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
