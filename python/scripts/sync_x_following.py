"""
@minstrel_live のフォローリストを twitterapi.io から取得し、
data/x_following_handles.json にキャッシュする。

実行方法（python/ ディレクトリから）:
  python scripts/sync_x_following.py

スケジューラーから:
  python run_scheduler.py --run-sync-following
"""
import json
import os
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from utils.config import TWITTERAPI_IO_KEY

FOLLOWINGS_URL = "https://api.twitterapi.io/twitter/user/followings"
TARGET_USER = "minstrel_live"
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DATA_PATH = os.path.join(DATA_DIR, "x_following_handles.json")


def fetch_following_list() -> list[str]:
    handles: list[str] = []
    cursor = ""
    page = 1

    while True:
        params: dict = {"userName": TARGET_USER, "pageSize": 200}
        if cursor:
            params["cursor"] = cursor

        resp = requests.get(
            FOLLOWINGS_URL,
            headers={"X-API-Key": TWITTERAPI_IO_KEY},
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

        followings = data.get("followings", [])
        for user in followings:
            handle = user.get("userName")
            if handle:
                handles.append(handle)

        print(f"  page {page}: {len(followings)} accounts (累計: {len(handles)})")

        if not data.get("has_next_page"):
            break
        cursor = data.get("next_cursor", "")
        if not cursor:
            break
        page += 1
        time.sleep(1)

    return handles


def run() -> list[str]:
    if not TWITTERAPI_IO_KEY:
        print("ERROR: TWITTERAPI_IO_KEY が未設定です")
        sys.exit(1)

    print(f"@{TARGET_USER} のフォローリスト取得中...")
    handles = fetch_following_list()
    print(f"取得完了: {len(handles)} アカウント")

    from datetime import datetime, timezone
    os.makedirs(DATA_DIR, exist_ok=True)
    payload = {
        "handles": handles,
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "count": len(handles),
    }
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"保存完了: {DATA_PATH}")
    return handles


if __name__ == "__main__":
    run()
