import json
import os
import re
import time
from datetime import datetime, timezone, timedelta

import requests

from utils.config import TWITTERAPI_IO_KEY, USER_AGENT

_FOLLOWING_CACHE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "x_following_handles.json",
)

API_URL = "https://api.twitterapi.io/twitter/tweet/advanced_search"

# ── キーワード検索クエリ（ハッシュタグ含む） ──────────────────────
SEARCH_QUERIES = [
    "#ゲーム音楽演奏会情報 -is:retweet lang:ja",
    "#ゲーム音楽コンサート -is:retweet lang:ja",
    "ゲーム音楽 コンサート -is:retweet lang:ja",
    "ゲームミュージック 演奏会 -is:retweet lang:ja",
    "ゲーム音楽 演奏会 -is:retweet lang:ja",
]

# 1リクエストあたりの最大ページ数（コスト制御）
MAX_PAGES_PER_QUERY = 3

# URL フェッチをスキップするドメイン（SNS・動画サイト等）
_SKIP_URL_DOMAINS = {
    "twitter.com", "x.com", "t.co",
    "instagram.com", "facebook.com",
    "youtube.com", "youtu.be",
    "tiktok.com",
}


def _tweet_url(tweet: dict) -> str:
    user = tweet.get("author", {}).get("userName", "unknown")
    tweet_id = tweet.get("id", "")
    return f"https://x.com/{user}/status/{tweet_id}"


def _build_raw_text(tweet: dict) -> str:
    author = tweet.get("author", {})
    lines = [
        f"投稿者: {author.get('name', '')} (@{author.get('userName', '')})",
        f"投稿日時: {tweet.get('createdAt', '')}",
        "",
        tweet.get("text", ""),
    ]
    return "\n".join(lines)


def _extract_tweet_urls(tweet: dict) -> list[str]:
    """entities.urls から外部URL（SNS・動画サイト除く）を返す。"""
    urls = []
    for u in (tweet.get("entities") or {}).get("urls", []):
        expanded = u.get("expanded_url", "")
        if expanded and not any(d in expanded for d in _SKIP_URL_DOMAINS):
            urls.append(expanded)
    return urls


def _extract_tweet_photos(tweet: dict) -> list[str]:
    """extendedEntities.media から写真URL（フライヤー候補）を返す。"""
    return [
        m["media_url_https"]
        for m in (tweet.get("extendedEntities") or {}).get("media", [])
        if m.get("type") == "photo" and m.get("media_url_https")
    ]


def _fetch_page_text(url: str) -> str | None:
    """URLのページ内容をプレーンテキストとして返す。失敗時はNone。"""
    try:
        resp = requests.get(
            url, timeout=12,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "ja,en;q=0.5"},
        )
        if not resp.ok:
            return None
        html = resp.text
        html = re.sub(r'<script[\s\S]*?</script>', ' ', html, flags=re.IGNORECASE)
        html = re.sub(r'<style[\s\S]*?</style>', ' ', html, flags=re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', html)
        text = re.sub(r'&[a-z]+;', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:3000] if text else None
    except Exception:
        return None


def _enrich_tweet(tweet: dict) -> dict | None:
    """
    ツイートを以下の優先度で強化して返す。
    Pattern 1: 外部URLあり → ページ内容を raw_text に使用
    Pattern 2: URLなし・写真あり → raw_text=ツイートテキスト + _flyer_image_url を設定
    Pattern 3: URLも写真もなし → None（スキップ）
    """
    tweet_text = _build_raw_text(tweet)
    external_urls = _extract_tweet_urls(tweet)
    photo_urls = _extract_tweet_photos(tweet)

    # Pattern 1: 外部URLをフェッチしてページ内容を取得
    for url in external_urls:
        page_text = _fetch_page_text(url)
        if page_text:
            print(f"[x_search] Pattern1: fetched {url[:60]}")
            return {
                "raw_text": page_text,
                "ticket_url": url,
                "_tweet_text": tweet_text,
                "_flyer_image_url": photo_urls[0] if photo_urls else None,
                "_has_page_content": True,
            }

    # Pattern 2: フライヤー画像のみ
    if photo_urls:
        print(f"[x_search] Pattern2: flyer image found")
        return {
            "raw_text": tweet_text,
            "_tweet_text": tweet_text,
            "_flyer_image_url": photo_urls[0],
            "_has_page_content": False,
        }

    # Pattern 3: URLも画像もなし → スキップ
    return None


def search_tweets(query: str, since_days: int = 3) -> list[dict]:
    """
    twitterapi.io でツイートを検索し、URL/画像で強化した結果リストを返す。
    since_days: 何日前から検索するか（デフォルト3日）
    """
    if not TWITTERAPI_IO_KEY:
        print("[x_search] TWITTERAPI_IO_KEY が未設定のためスキップ")
        return []

    since_ts = int(
        (datetime.now(timezone.utc) - timedelta(days=since_days)).timestamp()
    )
    full_query = f"{query} since_time:{since_ts}"

    headers = {"X-API-Key": TWITTERAPI_IO_KEY}
    results = []
    cursor = None
    skipped_p3 = 0

    for page in range(MAX_PAGES_PER_QUERY):
        params: dict = {"query": full_query, "queryType": "Latest"}
        if cursor:
            params["cursor"] = cursor

        try:
            resp = requests.get(API_URL, headers=headers, params=params, timeout=15)
            resp.raise_for_status()
        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 429:
                print(f"[x_search] rate limited at page {page+1}, returning {len(results)} results so far")
                break
            raise

        data = resp.json()

        tweets = data.get("tweets") or []
        for tweet in tweets:
            enriched = _enrich_tweet(tweet)
            if enriched is None:
                skipped_p3 += 1
                continue

            result = {
                "source_url": _tweet_url(tweet),
                "source_name": "x_search",
                "source_rank": "B",
                "tweet_id": tweet.get("id"),
                "created_at": tweet.get("createdAt"),
                "_author_handle": tweet.get("author", {}).get("userName", "").lower(),
            }
            result.update(enriched)
            results.append(result)

        if not data.get("has_next_page"):
            break

        cursor = data.get("next_cursor")
        if not cursor:
            break

        time.sleep(2)

    if skipped_p3:
        print(f"[x_search] skipped {skipped_p3} tweets (no URL, no image)")
    return results


def _load_monitored_handles() -> list[str]:
    """
    organizers テーブルから x_monitoring=true のハンドルリストを取得する。
    DB 接続に失敗した場合は空リストを返す（サイレント縮退）。
    """
    try:
        from utils.db import get_client
        result = (
            get_client()
            .table("organizers")
            .select("x_handle")
            .eq("x_monitoring", True)
            .not_.is_("x_handle", "null")
            .execute()
        )
        return [row["x_handle"] for row in result.data if row.get("x_handle")]
    except Exception as e:
        print(f"[x_search] failed to load monitored handles: {e}")
        return []


def _build_from_query(handles: list[str], since_days: int) -> str | None:
    """
    from: 指定の複合クエリを構築する。
    最大 20 アカウントを 1 クエリにまとめる。
    """
    if not handles:
        return None
    from_parts = " OR ".join(f"from:{h}" for h in handles[:20])
    return f"({from_parts}) -is:retweet"


def _load_following_handles() -> list[str]:
    """
    data/x_following_handles.json から @minstrel_live のフォローリストを読み込む。
    """
    try:
        if not os.path.exists(_FOLLOWING_CACHE_PATH):
            print("[x_search] x_following_handles.json 未生成。python scripts/sync_x_following.py を先に実行してください。")
            return []
        with open(_FOLLOWING_CACHE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        handles = data.get("handles", [])
        print(f"[x_search] フォローリスト読み込み: {len(handles)} アカウント (synced_at: {data.get('synced_at', 'unknown')})")
        return handles
    except Exception as e:
        print(f"[x_search] failed to load following handles: {e}")
        return []


def scrape_x_search(since_days: int = 3) -> list[dict]:
    """
    複数クエリでゲーム音楽コンサート関連ツイートを収集。
    各ツイートは URL フェッチ（Pattern 1）または画像（Pattern 2）で強化済み。
    URL も画像もないツイートはスキップ（Pattern 3）。
    """
    seen_ids: set[str] = set()
    all_results: list[dict] = []

    # ── 1. キーワード検索 ────────────────────────────────────────
    for query in SEARCH_QUERIES:
        try:
            tweets = search_tweets(query, since_days=since_days)
            for tweet in tweets:
                tid = tweet.get("tweet_id", tweet["source_url"])
                if tid not in seen_ids:
                    seen_ids.add(tid)
                    all_results.append(tweet)
            print(f"[x_search] keyword='{query[:35]}...' => {len(tweets)} tweets")
        except Exception as e:
            print(f"[x_search] error for query '{query[:35]}': {e}")
        time.sleep(3)

    # ── 2. 監視アカウント（from: 指定）────────────────────────────
    handles = _load_monitored_handles()
    if handles:
        from_query = _build_from_query(handles, since_days)
        if from_query:
            try:
                tweets = search_tweets(from_query, since_days=since_days)
                new_count = 0
                for tweet in tweets:
                    tid = tweet.get("tweet_id", tweet["source_url"])
                    if tid not in seen_ids:
                        seen_ids.add(tid)
                        tweet["source_name"] = "x_monitored"
                        all_results.append(tweet)
                        new_count += 1
                print(f"[x_search] monitored accounts ({len(handles)}) => {new_count} new tweets")
            except Exception as e:
                print(f"[x_search] error for monitored accounts: {e}")

    # ── 3. フォローリスト（バッチ from: 指定）────────────────────────
    following_handles = _load_following_handles()
    monitored_set = set(handles)
    new_following = [h for h in following_handles if h not in monitored_set]
    BATCH_SIZE = 20
    for i in range(0, len(new_following), BATCH_SIZE):
        batch = new_following[i:i + BATCH_SIZE]
        from_query = _build_from_query(batch, since_days)
        if from_query:
            try:
                tweets = search_tweets(from_query, since_days=since_days)
                new_count = 0
                for tweet in tweets:
                    tid = tweet.get("tweet_id", tweet["source_url"])
                    if tid not in seen_ids:
                        seen_ids.add(tid)
                        tweet["source_name"] = "x_followed"
                        all_results.append(tweet)
                        new_count += 1
                print(f"[x_search] following batch {i // BATCH_SIZE + 1} ({len(batch)} accounts) => {new_count} new tweets")
            except Exception as e:
                print(f"[x_search] error for following batch {i // BATCH_SIZE + 1}: {e}")
            time.sleep(3)

    print(f"[x_search] total unique tweets: {len(all_results)}")
    return all_results
