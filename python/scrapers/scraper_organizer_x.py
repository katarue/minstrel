"""
演奏団体の公式 X アカウントからプロフィール画像と最終投稿日時を取得し、
organizers テーブルの x_profile_image_url と x_last_active_at を更新する。
"""
import time
from datetime import datetime, timezone

import requests

from utils.config import TWITTERAPI_IO_KEY

API_URL = "https://api.twitterapi.io/twitter/tweet/advanced_search"


def _extract_handle(x_url: str) -> str | None:
    parts = x_url.rstrip("/").split("/")
    handle = parts[-1]
    return handle if handle else None


def _fetch_latest_tweet(handle: str) -> dict | None:
    if not TWITTERAPI_IO_KEY:
        print("[organizer_x] TWITTERAPI_IO_KEY 未設定のためスキップ")
        return None

    headers = {"X-API-Key": TWITTERAPI_IO_KEY}
    params = {"query": f"from:{handle} -is:retweet", "queryType": "Latest"}

    try:
        resp = requests.get(API_URL, headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        tweets = data.get("tweets") or []
        return tweets[0] if tweets else None
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 429:
            print(f"[organizer_x] @{handle}: rate limited")
        else:
            print(f"[organizer_x] @{handle}: HTTP error {e}")
        return None
    except Exception as e:
        print(f"[organizer_x] @{handle}: error {e}")
        return None


def scrape_organizer_x() -> int:
    """x_url が設定されている organizer を巡回し、プロフィール情報を更新する。"""
    from utils.db import get_client

    db = get_client()
    result = (
        db.table("organizers")
        .select("id, name, x_url")
        .not_.is_("x_url", "null")
        .execute()
    )
    organizers = result.data or []

    if not organizers:
        print("[organizer_x] 対象の演奏団体がありません")
        return 0

    updated = 0
    for org in organizers:
        handle = _extract_handle(org["x_url"])
        if not handle:
            continue

        print(f"[organizer_x] @{handle} ({org['name']}) 取得中...")
        tweet = _fetch_latest_tweet(handle)

        if tweet:
            author = tweet.get("author", {})
            profile_image_url = author.get("profileImageUrl")
            created_at = tweet.get("createdAt", "")

            try:
                last_active = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                last_active = None

            update_data: dict = {}
            if profile_image_url:
                # _normal (48px) → _400x400 (高解像度)
                update_data["x_profile_image_url"] = profile_image_url.replace("_normal", "_400x400")
            if last_active:
                update_data["x_last_active_at"] = last_active.isoformat()

            if update_data:
                db.table("organizers").update(update_data).eq("id", org["id"]).execute()
                print(f"[organizer_x] ✓ {org['name']}: 最終投稿 {last_active}")
                updated += 1
        else:
            print(f"[organizer_x] ✗ @{handle}: ツイートが取得できませんでした")

        time.sleep(3)

    print(f"[organizer_x] 更新完了: {updated}/{len(organizers)} 件")
    return updated
