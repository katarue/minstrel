"""
チケット発売日取得モジュール。

取得経路:
  A. source_url スクレイピング（チケットサイトのイベントページ）
  B. X（Twitter）監視アカウントの投稿テキスト解析

対応サイト（A）:
  - e+ (eplus.jp)
  - チケットぴあ (t.pia.jp)
  - ローソンチケット (l-tike.com)
  - その他（汎用パターン）
"""

import re
import time
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8",
}

# 一般発売日を示すパターン（優先度順）
_DATE_PATTERNS = [
    r'一般発売[：:\s]*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日',
    r'発売日[：:\s]*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日',
    r'販売開始[：:\s]*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日',
    r'チケット発売[：:\s]*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日',
    r'一般発売[：:\s]*(\d{4})/(\d{1,2})/(\d{1,2})',
    r'発売[：:\s]*(\d{4})/(\d{1,2})/(\d{1,2})',
]


def _extract_sale_date(text: str) -> Optional[str]:
    """テキストから発売日を抽出し YYYY-MM-DD 形式で返す。見つからない場合は None。"""
    for pattern in _DATE_PATTERNS:
        m = re.search(pattern, text)
        if m:
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            try:
                return date(y, mo, d).isoformat()
            except ValueError:
                continue
    return None


def fetch_ticket_sale_date(url: str) -> Optional[str]:
    """1件の URL からチケット発売日を取得して返す。失敗時は None。"""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=10, allow_redirects=True)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.content, "lxml")
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text(separator="\n")
        return _extract_sale_date(text)
    except Exception as e:
        print(f"[ticket_sale] fetch error {url[:60]}: {e}")
        return None


# ── X（Twitter）監視による発売日取得 ──────────────────────────────────

# チケット発売を示すキーワード（X検索クエリ用）
_SALE_KEYWORDS_QUERY = "(一般発売 OR チケット発売 OR 発売開始 OR 発売日)"

# イベント名から意味のある語句を抽出する最小文字数
_MIN_KEYWORD_LEN = 4


def _extract_event_keywords(event_name: str) -> list[str]:
    """イベント名から検索用キーワードリストを返す。"""
    # 記号・括弧を除いた語句で 4 文字以上のもの
    tokens = re.split(r'[\s　\-\.\|【】「」（）()　]+', event_name)
    return [t for t in tokens if len(t) >= _MIN_KEYWORD_LEN]


def _match_event(tweet_text: str, candidate_events: list[dict]) -> Optional[dict]:
    """
    ツイートテキストとイベント候補リストを照合して最初にマッチしたイベントを返す。
    候補が1件なら無条件で返す。複数の場合はイベント名キーワードで絞り込む。
    """
    if len(candidate_events) == 1:
        return candidate_events[0]
    for ev in candidate_events:
        keywords = _extract_event_keywords(ev.get("event_name", ""))
        if any(kw in tweet_text for kw in keywords):
            return ev
    return None


def fetch_ticket_sale_dates_from_x() -> int:
    """
    X（Twitter）の監視アカウント投稿からチケット発売日を取得してDBを更新する。

    処理フロー:
      1. organizers.x_monitoring=true のアカウントを取得
      2. X で発売キーワード + from: 指定で検索（直近7日）
      3. 投稿テキストから発売日を正規表現で抽出
         → 見つからない場合は投稿内の外部 URL をスクレイピング
      4. 投稿者 handle → organizer_id → 未設定イベントにマッチング
      5. マッチしたイベントの ticket_sale_start を更新
    """
    from scrapers.scraper_x_search import search_tweets
    from utils.db import get_client

    db = get_client()

    # 監視アカウント（handle → organizer_id）
    org_result = (
        db.table("organizers")
        .select("id, x_handle")
        .eq("x_monitoring", True)
        .not_.is_("x_handle", "null")
        .execute()
    )
    organizers: dict[str, str] = {
        row["x_handle"].lower(): row["id"]
        for row in (org_result.data or [])
        if row.get("x_handle")
    }
    if not organizers:
        print("[ticket_sale_x] 監視アカウントなし")
        return 0

    # 発売日未設定の公開済みイベントを organizer_id でグループ化
    ev_result = (
        db.table("events")
        .select("id, event_name, organizer_id")
        .eq("is_published", True)
        .is_("ticket_sale_start", "null")
        .not_.is_("organizer_id", "null")
        .execute()
    )
    events_by_org: dict[str, list[dict]] = {}
    for ev in (ev_result.data or []):
        oid = ev["organizer_id"]
        events_by_org.setdefault(oid, []).append(ev)

    # handle → 候補イベント リスト
    handle_to_events: dict[str, list[dict]] = {
        handle: events_by_org.get(oid, [])
        for handle, oid in organizers.items()
    }

    # X 検索（監視アカウントの発売キーワード投稿）
    handles = list(organizers.keys())
    from_clause = " OR ".join(f"from:{h}" for h in handles[:20])
    query = f"({from_clause}) {_SALE_KEYWORDS_QUERY} -is:retweet"
    print(f"[ticket_sale_x] searching X: {len(handles)} accounts")

    try:
        tweets = search_tweets(query, since_days=7)
    except Exception as e:
        print(f"[ticket_sale_x] X search error: {e}")
        return 0

    updated = 0
    for tweet in tweets:
        author = tweet.get("_author_handle", "").lower()
        candidate_events = handle_to_events.get(author, [])
        if not candidate_events:
            continue

        # ツイートテキストから発売日を抽出
        tweet_text = tweet.get("_tweet_text") or tweet.get("raw_text", "")
        sale_date = _extract_sale_date(tweet_text)

        # テキストになければ外部 URL をスクレイピング
        if not sale_date:
            ticket_url = tweet.get("ticket_url")
            if ticket_url:
                sale_date = fetch_ticket_sale_date(ticket_url)
                time.sleep(0.5)

        if not sale_date:
            continue

        matched = _match_event(tweet_text, candidate_events)
        if not matched:
            print(f"[ticket_sale_x] {author}: {len(candidate_events)} 件候補あり、マッチ不可 (sale={sale_date})")
            continue

        db.table("events").update({"ticket_sale_start": sale_date}).eq("id", matched["id"]).execute()
        print(f"[ticket_sale_x] {author} → {matched['event_name'][:30]} → {sale_date}")
        updated += 1

    print(f"[ticket_sale_x] updated {updated} events")
    return updated
