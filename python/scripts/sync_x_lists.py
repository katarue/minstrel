"""
X リスト（game_music_exclusive / game_music_partial）を twitterapi.io から取得し、
organizers テーブルの trust_tier を同期する。

実行方法（python/ ディレクトリから）:
  python scripts/sync_x_lists.py

動作:
  - exclusive リストのメンバー → trust_tier = 'exclusive'
  - partial リストのメンバー   → trust_tier = 'partial'
  - どちらにも属さない既存オーガナイザー → trust_tier = 'unknown' にリセット
"""
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from utils.config import TWITTERAPI_IO_KEY
from utils.db import get_client

LIST_IDS = {
    "exclusive": "2054334048143909013",
    "partial":   "2054335108963029017",
}

LIST_MEMBERS_URL = "https://api.twitterapi.io/twitter/list/members"


def fetch_list_members(list_id: str) -> list[str]:
    """リストメンバーの userName を全件取得（ページネーション対応）。"""
    handles: list[str] = []
    cursor = None

    while True:
        params: dict = {"list_id": list_id}
        if cursor:
            params["cursor"] = cursor

        resp = requests.get(
            LIST_MEMBERS_URL,
            headers={"X-API-Key": TWITTERAPI_IO_KEY},
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        for member in data.get("members", []):
            handle = member.get("userName")
            if handle:
                handles.append(handle.lower())

        if not data.get("has_next_page"):
            break
        cursor = data.get("next_cursor")
        if not cursor:
            break
        time.sleep(1)

    return handles


def sync(dry_run: bool = False) -> None:
    if not TWITTERAPI_IO_KEY:
        print("ERROR: TWITTERAPI_IO_KEY が未設定です")
        sys.exit(1)

    db = get_client()

    # ── 1. X リストからメンバーを取得 ──────────────────────────────
    tier_by_handle: dict[str, str] = {}
    for tier, list_id in LIST_IDS.items():
        print(f"[sync] {tier} リスト取得中 (id={list_id})...")
        handles = fetch_list_members(list_id)
        print(f"  {len(handles)} 件")
        for h in handles:
            tier_by_handle[h] = tier
        time.sleep(1)

    # ── 2. DB の全オーガナイザーを取得 ───────────────────────────────
    result = db.table("organizers").select("id, name, x_handle, trust_tier").execute()
    organizers = result.data

    updated = 0
    skipped_no_handle = 0
    skipped_no_change = 0
    not_found_in_list = 0

    for org in organizers:
        x_handle = org.get("x_handle")
        if not x_handle:
            skipped_no_handle += 1
            continue

        handle_lower = x_handle.lstrip("@").lower()
        new_tier = tier_by_handle.get(handle_lower, "unknown")
        current_tier = org.get("trust_tier", "unknown")

        if new_tier == current_tier:
            skipped_no_change += 1
            continue

        if new_tier == "unknown":
            not_found_in_list += 1

        print(f"  {'[DRY]' if dry_run else '[UPDATE]'} @{x_handle} ({org['name']}): {current_tier} → {new_tier}")
        if not dry_run:
            db.table("organizers").update({"trust_tier": new_tier}).eq("id", org["id"]).execute()
        updated += 1

    # ── 3. リストにあるが DB に存在しないハンドル ──────────────────────
    db_handles = {
        o["x_handle"].lstrip("@").lower()
        for o in organizers
        if o.get("x_handle")
    }
    missing = [h for h in tier_by_handle if h not in db_handles]
    if missing:
        print(f"\n[sync] DB に未登録のリストメンバー ({len(missing)} 件):")
        for h in missing:
            print(f"  @{h} ({tier_by_handle[h]})")
        print("  ※ これらはイベント登録時に自動追加されます")

    print(f"\n[sync] 完了: 更新={updated} / 変更なし={skipped_no_change} / handle未設定={skipped_no_handle} / リスト外リセット={not_found_in_list}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("[sync] DRY RUN モード（DB は変更しません）")
    sync(dry_run=dry_run)
