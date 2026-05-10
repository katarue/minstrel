"""
放送局の公式 X アカウントを監視し、ゲーム音楽番組の放送情報を収集する。
broadcasters テーブルの x_handle を対象に twitterapi.io でツイートを取得し、
Claude Haiku で放送情報を構造化する。
"""
import json
import time
from datetime import datetime, timedelta, timezone

import anthropic
import requests

from utils.config import ANTHROPIC_API_KEY, TWITTERAPI_IO_KEY

API_URL = "https://api.twitterapi.io/twitter/tweet/advanced_search"
MAX_PAGES = 2

EXTRACTION_SYSTEM = """
あなたは放送局の公式Xアカウントのツイートから、ゲーム音楽番組の放送・配信情報を抽出するアシスタントです。

放送情報（今後の放送予告・見逃し配信案内など）のツイートであれば以下のJSONを返してください。
放送情報でない場合（過去の感想・イベント告知・一般告知等）は null を返してください。

{
  "program_name": "番組名（string）",
  "channel": "放送チャンネル（例: 'NHK BS', 'NHK Eテレ', 'NHK総合' など）",
  "broadcast_datetime": "放送日時 ISO 8601 JST（例: '2026-05-09T23:10:00+09:00'）。不明なら null",
  "is_replay": "再放送・再配信なら true（boolean）",
  "vod_url": "見逃し配信・公式動画URL（string or null）",
  "description": "30〜80字の日本語要約（string or null）"
}

注意:
- 「今夜」「明日」などはツイートの投稿日時を基準に絶対日時へ変換する
- 「再放送」「再配信」「見逃し」があれば is_replay = true
- JSONのみ返すこと（説明文不要）
"""

_anthropic = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def _tweet_url(tweet: dict) -> str:
    user = tweet.get("author", {}).get("userName", "unknown")
    return f"https://x.com/{user}/status/{tweet.get('id', '')}"


def _fetch_tweets(handle: str, since_days: int) -> list[dict]:
    if not TWITTERAPI_IO_KEY:
        print("[broadcasts] TWITTERAPI_IO_KEY 未設定のためスキップ")
        return []

    since_ts = int((datetime.now(timezone.utc) - timedelta(days=since_days)).timestamp())
    query = f"from:{handle} -is:retweet since_time:{since_ts}"
    headers = {"X-API-Key": TWITTERAPI_IO_KEY}
    results = []
    cursor = None

    for page in range(MAX_PAGES):
        params: dict = {"query": query, "queryType": "Latest"}
        if cursor:
            params["cursor"] = cursor
        try:
            resp = requests.get(API_URL, headers=headers, params=params, timeout=15)
            resp.raise_for_status()
        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 429:
                print(f"[broadcasts] rate limited for @{handle}")
                break
            raise

        data = resp.json()
        for tweet in data.get("tweets") or []:
            results.append({
                "source_url": _tweet_url(tweet),
                "tweet_id": tweet.get("id"),
                "created_at": tweet.get("createdAt", ""),
                "text": tweet.get("text", ""),
            })

        if not data.get("has_next_page"):
            break
        cursor = data.get("next_cursor")
        if not cursor:
            break
        time.sleep(2)

    return results


def _extract(tweet: dict, broadcaster_name: str) -> dict | None:
    prompt = (
        f"放送局: {broadcaster_name}\n"
        f"投稿日時: {tweet['created_at']}\n\n"
        f"ツイート:\n{tweet['text']}"
    )
    try:
        resp = _anthropic.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=EXTRACTION_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        if raw.lower() == "null" or not raw:
            return None
        if "```" in raw:
            raw = raw.split("```")[1].lstrip("json").strip()
        data = json.loads(raw)
        if not data.get("program_name"):
            return None
        return data
    except Exception as e:
        print(f"[broadcasts] extraction error: {e}")
        return None


def scrape_broadcasts(since_days: int = 2) -> list[dict]:
    """broadcasters テーブルの x_handle を巡回し、放送情報を収集する。"""
    from utils.db import get_client

    db = get_client()
    result = (
        db.table("broadcasters")
        .select("id, name, x_handle")
        .eq("is_active", True)
        .not_.is_("x_handle", "null")
        .execute()
    )
    broadcasters = result.data or []

    if not broadcasters:
        print("[broadcasts] 監視対象の放送局がありません")
        return []

    all_broadcasts: list[dict] = []
    for bc in broadcasters:
        handle = bc["x_handle"]
        print(f"[broadcasts] @{handle} 取得中...")
        tweets = _fetch_tweets(handle, since_days=since_days)
        print(f"[broadcasts] @{handle}: {len(tweets)} tweets")

        for tweet in tweets:
            extracted = _extract(tweet, bc["name"])
            if not extracted:
                continue
            all_broadcasts.append({
                "broadcaster_id": bc["id"],
                "source_url": tweet["source_url"],
                **extracted,
            })
            time.sleep(0.5)

        time.sleep(3)

    print(f"[broadcasts] 抽出完了: {len(all_broadcasts)} 件")
    return all_broadcasts
