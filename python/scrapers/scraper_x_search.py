import time
from datetime import datetime, timezone, timedelta

import requests

from utils.config import TWITTERAPI_IO_KEY

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


def search_tweets(query: str, since_days: int = 3) -> list[dict]:
    """
    twitterapi.io でツイートを検索し、生データのリストを返す。
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
            results.append({
                "source_url": _tweet_url(tweet),
                "source_name": "x_search",
                "source_rank": "B",
                "raw_text": _build_raw_text(tweet),
                "tweet_id": tweet.get("id"),
                "created_at": tweet.get("createdAt"),
            })

        if not data.get("has_next_page"):
            break

        cursor = data.get("next_cursor")
        if not cursor:
            break

        # ページ間: 2 秒待機
        time.sleep(2)

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
    twitterapi.io は OR 演算子が使えるので bundle する。
    最大 20 アカウントを 1 クエリにまとめる。
    """
    if not handles:
        return None
    # (from:A OR from:B OR ...) -is:retweet
    from_parts = " OR ".join(f"from:{h}" for h in handles[:20])
    return f"({from_parts}) -is:retweet"


def scrape_x_search(since_days: int = 3) -> list[dict]:
    """
    複数クエリでゲーム音楽コンサート関連ツイートを収集。
    1. キーワード検索（ハッシュタグ含む）
    2. 監視アカウント（from: 指定）
    重複ツイート（同じ tweet_id）を除去して返す。
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
                        # 監視アカウントの公式ツイートは source_name を区別
                        tweet["source_name"] = "x_monitored"
                        all_results.append(tweet)
                        new_count += 1
                print(f"[x_search] monitored accounts ({len(handles)}) => {new_count} new tweets")
            except Exception as e:
                print(f"[x_search] error for monitored accounts: {e}")

    print(f"[x_search] total unique tweets: {len(all_results)}")
    return all_results
