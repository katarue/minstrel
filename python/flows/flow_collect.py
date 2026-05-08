from prefect import flow, task
from scrapers.scraper_2083web import Scraper2083Web
from processor.claude_extractor import extract_event
from validator.machine_validator import validate
from utils.db import get_client


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
            results.append(extracted)
    return results


@task
def validate_events(events: list[dict]) -> list[dict]:
    return [validate(e) for e in events]


@task
def upsert_to_db(events: list[dict]) -> int:
    db = get_client()
    count = 0
    for event in events:
        # 重複チェック: title + start_datetime の組み合わせで判定
        existing = (
            db.table("events")
            .select("id")
            .eq("title", event.get("title", ""))
            .eq("start_datetime", event.get("start_datetime", ""))
            .execute()
        )
        if existing.data:
            continue  # 既存レコードはスキップ（将来は UPDATE に変更予定）
        db.table("events").insert({
            "title": event.get("title"),
            "start_datetime": event.get("start_datetime"),
            "venue": event.get("venue"),
            "description": event.get("description"),
            "source_url": event.get("source_url"),
            "auto_publish_eligible": event.get("auto_publish_eligible", False),
            "is_published": False,
        }).execute()
        count += 1
    return count


@flow(name="minstrel-collect", log_prints=True)
def collect_flow():
    raw = scrape_2083web()
    print(f"scraped: {len(raw)} items")

    extracted = extract_events(raw)
    print(f"extracted: {len(extracted)} items")

    validated = validate_events(extracted)
    print(f"validated: {len(validated)} items")

    inserted = upsert_to_db(validated)
    print(f"inserted: {inserted} new events")


if __name__ == "__main__":
    collect_flow()
