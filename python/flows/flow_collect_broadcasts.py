"""
放送・配信情報収集フロー

スケジュール:
  - bangumi.org（地上波・BS）: 2日おき 07:00 JST（直近10日分を取得）
  - X監視（放送局アカウント）: 毎日 08:00 JST（直近2日分）
"""
from datetime import datetime, timezone

from prefect import flow, task

from scrapers.scraper_bangumi import scrape_bangumi
from scrapers.scraper_broadcasts import scrape_broadcasts
from utils.db import get_client

FLOW_NAME = "minstrel-collect-broadcasts"
FLOW_NAME_WEEKLY = "minstrel-collect-broadcasts-weekly"


@task
def fetch_x_broadcasts(since_days: int = 2) -> list[dict]:
    return scrape_broadcasts(since_days=since_days)


@task
def fetch_bangumi(days_ahead: int = 14) -> list[dict]:
    return scrape_bangumi(days_ahead=days_ahead)


@task
def upsert_broadcasts(broadcasts: list[dict]) -> int:
    db = get_client()
    inserted = 0

    for bc in broadcasts:
        source_url = bc.get("source_url", "")
        if not source_url:
            continue

        row = {
            "program_name": bc["program_name"],
            "broadcaster_id": bc.get("broadcaster_id"),
            "channel": bc.get("channel"),
            "broadcast_datetime": bc.get("broadcast_datetime"),
            "is_replay": bc.get("is_replay", False),
            "vod_url": bc.get("vod_url"),
            "description": bc.get("description"),
            "source_url": source_url,
            "is_published": True,
        }

        result = (
            db.table("broadcasts")
            .upsert(row, on_conflict="source_url", ignore_duplicates=True)
            .execute()
        )
        if result.data:
            inserted += 1

    print(f"[broadcasts] upserted={inserted}")
    return inserted


@flow(name=FLOW_NAME, log_prints=True)
def collect_broadcasts_flow():
    """毎日実行: X監視（放送局アカウント）による放送情報収集"""
    try:
        broadcasts = fetch_x_broadcasts(since_days=2)
        print(f"x_broadcasts found: {len(broadcasts)}")
        inserted = upsert_broadcasts(broadcasts)
        print(f"inserted: {inserted} new broadcasts")
    except Exception as e:
        print(f"[error] {e}")
        raise


@flow(name=FLOW_NAME_WEEKLY, log_prints=True)
def collect_broadcasts_weekly_flow():
    """2日おき実行: bangumi.org による地上波・BS 10日分の収集"""
    try:
        broadcasts = fetch_bangumi(days_ahead=10)
        print(f"bangumi found: {len(broadcasts)}")
        inserted = upsert_broadcasts(broadcasts)
        print(f"inserted: {inserted} new broadcasts")
    except Exception as e:
        print(f"[error] {e}")
        raise


if __name__ == "__main__":
    collect_broadcasts_weekly_flow()
