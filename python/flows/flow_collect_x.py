"""
X ソース専用収集フロー。

キーワード検索・監視アカウント・フォローリストからツイートを収集し、
trust_tier=exclusive のオーガナイザーからの告知を自動公開対象とする。

実行方法（python/ ディレクトリから）:
  python flows/flow_collect_x.py

スケジューラーから:
  python run_scheduler.py --run-x
  python run_scheduler.py --serve-x
"""
import json
import os
from datetime import datetime, timezone, timedelta

from prefect import flow, task

from scrapers.scraper_x_search import scrape_x_search, _FOLLOWING_CACHE_PATH
from scripts.sync_x_lists import _SYNC_STATE_PATH as _LISTS_SYNC_STATE_PATH
from flows.flow_collect import (
    extract_events,
    validate_events,
    process_images,
    upsert_to_db,
    fetch_missing_igdb_covers,
    _log_run,
)
from utils.notify import notify_failure, notify_success

FLOW_NAME = "minstrel-collect-x"


@task
def sync_following_if_stale(max_age_days: int = 7) -> None:
    """フォローリスト JSON が max_age_days 以上古い場合に再同期する。"""
    stale = True
    if os.path.exists(_FOLLOWING_CACHE_PATH):
        try:
            with open(_FOLLOWING_CACHE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            synced_at = data.get("synced_at")
            if synced_at:
                age = datetime.now(timezone.utc) - datetime.fromisoformat(synced_at)
                stale = age > timedelta(days=max_age_days)
        except Exception:
            stale = True

    if stale:
        print("[sync_following] フォローリストが古いため再同期します")
        import sys
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from scripts.sync_x_following import run as sync_run
        sync_run()
    else:
        print("[sync_following] フォローリストは最新です（スキップ）")


@task
def sync_x_lists_if_stale(max_age_days: int = 7) -> None:
    """X リスト（exclusive / partial）の trust_tier が max_age_days 以上古い場合に再同期する。"""
    stale = True
    if os.path.exists(_LISTS_SYNC_STATE_PATH):
        try:
            with open(_LISTS_SYNC_STATE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            synced_at = data.get("synced_at")
            if synced_at:
                age = datetime.now(timezone.utc) - datetime.fromisoformat(synced_at)
                stale = age > timedelta(days=max_age_days)
        except Exception:
            stale = True

    if stale:
        print("[sync_x_lists] X リストが古いため trust_tier を再同期します")
        from scripts.sync_x_lists import sync as lists_sync
        lists_sync()
    else:
        print("[sync_x_lists] X リストは最新です（スキップ）")


@task
def scrape_x(since_days: int = 1) -> list[dict]:
    return scrape_x_search(since_days=since_days)


@flow(name=FLOW_NAME, log_prints=True)
def collect_x_flow(since_days: int = 1):
    started_at = datetime.now(timezone.utc)
    scraped_count = 0
    inserted_count = 0
    try:
        sync_following_if_stale(max_age_days=0)
        sync_x_lists_if_stale()
        raw_x = scrape_x(since_days=since_days)
        scraped_count = len(raw_x)
        print(f"scraped: x={scraped_count}")

        extracted = extract_events(raw_x)
        print(f"extracted: {len(extracted)} items")

        validated = validate_events(extracted)
        print(f"validated: {len(validated)} items")

        with_images = process_images(validated)
        inserted_count = upsert_to_db(with_images)
        print(f"inserted: {inserted_count} new events")

        fetch_missing_igdb_covers()

        _log_run(started_at, "success", scraped_count, inserted_count)
        notify_success(FLOW_NAME, scraped_count, inserted_count)

    except Exception as e:
        error_msg = str(e)
        print(f"[error] {error_msg}")
        _log_run(started_at, "failed", scraped_count, inserted_count, error_msg)
        notify_failure(FLOW_NAME, error_msg)
        raise


if __name__ == "__main__":
    collect_x_flow()
