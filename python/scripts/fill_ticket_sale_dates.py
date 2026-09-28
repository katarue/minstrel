"""
ticket_sale_start が未設定のイベントを source_url からスクレイピングして一括更新する。
実行: python scripts/fill_ticket_sale_dates.py [--dry-run]
"""

import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from utils.db import get_client
from processor.ticket_sale_fetcher import fetch_ticket_sale_date

DRY_RUN = "--dry-run" in sys.argv
SLEEP_SEC = 0.8


def main():
    db = get_client()

    rows = (
        db.table("events")
        .select("id, event_name, source_url")
        .eq("is_published", True)
        .is_("ticket_sale_start", "null")
        .not_.is_("source_url", "null")
        .execute()
        .data
    ) or []

    print(f"対象: {len(rows)} 件  dry_run={DRY_RUN}")

    updated = 0
    for ev in rows:
        url = ev["source_url"]
        sale_date = fetch_ticket_sale_date(url)
        status = sale_date or "—"
        print(f"  {ev['event_name'][:35]:<35}  {status}")

        if sale_date and not DRY_RUN:
            db.table("events").update({"ticket_sale_start": sale_date}).eq("id", ev["id"]).execute()
            updated += 1

        time.sleep(SLEEP_SEC)

    print(f"\n完了: {updated} 件更新")


if __name__ == "__main__":
    main()
