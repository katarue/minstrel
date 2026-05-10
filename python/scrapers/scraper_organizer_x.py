"""
演奏団体の公式 X アカウントからプロフィール画像と最終投稿日時を取得し、
organizers テーブルの x_profile_image_url と x_last_active_at を更新する。
"""
import time
from datetime import datetime, timezone

import requests

from utils.config import TWITTERAPI_IO_KEY

# ユーザー自身のタイムライン取得（1リクエストでアイコンURL＋最終投稿日を取得）
USER_TWEETS_URL = "https://api.twitterapi.io/twitter/user/last_tweets"


def _extract_handle(x_url: str) -> str | None:
    parts = x_url.rstrip("/").split("/")
    handle = parts[-1]
    return handle if handle else None


def _fetch_user_data(handle: str) -> tuple[str | None, str | None]:
    """(profile_image_url, last_tweet_created_at) を返す。取得失敗時は (None, None)。"""
    if not TWITTERAPI_IO_KEY:
        print("[organizer_x] TWITTERAPI_IO_KEY 未設定のためスキップ")
        return None, None

    headers = {"X-API-Key": TWITTERAPI_IO_KEY}

    try:
        resp = requests.get(USER_TWEETS_URL, headers=headers, params={"userName": handle, "count": 1}, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        tweets = data.get("tweets") or []
        if not tweets:
            return None, None

        tweet = tweets[0]
        last_created_at = tweet.get("createdAt") or tweet.get("created_at")
        author = tweet.get("author") or {}
        raw_img = author.get("profileImageUrl") or author.get("profile_image_url")
        profile_image_url = raw_img.replace("_normal", "_400x400") if raw_img else None
        return profile_image_url, last_created_at

    except requests.exceptions.HTTPError as e:
        code = e.response.status_code if e.response is not None else "?"
        print(f"[organizer_x] @{handle}: HTTP {code}")
        return None, None
    except Exception as e:
        print(f"[organizer_x] @{handle}: error {e}")
        return None, None


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
        profile_image_url, last_created_at = _fetch_user_data(handle)

        update_data: dict = {}
        if profile_image_url:
            update_data["x_profile_image_url"] = profile_image_url

        if last_created_at:
            try:
                last_active = datetime.fromisoformat(last_created_at.replace("Z", "+00:00"))
                update_data["x_last_active_at"] = last_active.isoformat()
            except (ValueError, AttributeError):
                pass

        if update_data:
            db.table("organizers").update(update_data).eq("id", org["id"]).execute()
            print(f"[organizer_x] ✓ {org['name']}: アイコン={bool(profile_image_url)} 最終投稿={last_created_at or '不明'}")
            updated += 1
        else:
            print(f"[organizer_x] ✗ @{handle}: データ取得できず")

        time.sleep(10)

    print(f"[organizer_x] 更新完了: {updated}/{len(organizers)} 件")
    return updated
