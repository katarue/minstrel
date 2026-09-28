"""
既存イベントの venue_name_en を Google Places API (Text Search) で一括取得する。
- venue_name が設定済みで venue_name_en が未設定のレコードが対象
- 同じ venue_name は API を 1 回だけ呼んでキャッシュ
- 実行: python scripts/fetch_venue_english_names.py
"""

import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import requests
from dotenv import load_dotenv
from utils.db import get_client

load_dotenv()

PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
PLACES_URL = "https://places.googleapis.com/v1/places:searchText"


def search_venue_en(venue_name: str, prefecture: str | None) -> str | None:
    query = venue_name + (f" {prefecture}" if prefecture else "")
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": PLACES_API_KEY,
        "X-Goog-FieldMask": "places.displayName",
    }
    body = {
        "textQuery": query,
        "languageCode": "en",
    }
    try:
        res = requests.post(PLACES_URL, json=body, headers=headers, timeout=10)
        if not res.ok:
            print(f"  [ERROR] status={res.status_code} body={res.text[:300]}")
            res.raise_for_status()
        data = res.json()
        places = data.get("places", [])
        if places:
            return places[0].get("displayName", {}).get("text")
    except Exception as e:
        print(f"  [ERROR] {venue_name}: {e}")
    return None


def main():
    if not PLACES_API_KEY:
        print("GOOGLE_PLACES_API_KEY が未設定です")
        return

    db = get_client()

    rows = (
        db.table("events")
        .select("id, venue_name, prefecture")
        .not_.is_("venue_name", "null")
        .is_("venue_name_en", "null")
        .eq("is_published", True)
        .execute()
        .data
    )

    print(f"対象レコード: {len(rows)} 件")

    # venue_name でデデュープ（同じ会場への重複APIコールを防ぐ）
    cache: dict[str, str | None] = {}
    updated = 0
    skipped = 0

    for row in rows:
        venue = row["venue_name"]
        prefecture = row.get("prefecture")
        cache_key = f"{venue}|{prefecture or ''}"

        if cache_key not in cache:
            print(f"  検索中: {venue}（{prefecture}）")
            en_name = search_venue_en(venue, prefecture)
            cache[cache_key] = en_name
            if en_name:
                print(f"    → {en_name}")
            else:
                print(f"    → 見つからず")
            time.sleep(0.3)  # レート制限対策
        else:
            en_name = cache[cache_key]

        if en_name:
            db.table("events").update({"venue_name_en": en_name}).eq("id", row["id"]).execute()
            updated += 1
        else:
            skipped += 1

    print(f"\n完了: 更新 {updated} 件 / スキップ {skipped} 件")


if __name__ == "__main__":
    main()
