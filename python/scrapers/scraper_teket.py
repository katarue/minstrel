"""
teket（テケト）スクレイパー。
https://teket.jp/ からゲーム音楽関連のイベント情報を収集する。

API エンドポイント: GET /api/events?word=...&category=...&p=N
一覧ページは CSR のため HTML スクレイピング不可。JSON API を使用。

robots.txt 確認済み: イベント一覧・詳細ページはスクレイピング許可範囲内。
ソースランク B（チケット発売中 = 開催確定のため、実績確認後に A 昇格可能）。
"""

import time
from scrapers.base import BaseScraper
from utils.config import SCRAPE_RATE_LIMIT_SEC

# teket API の実測: 正常レスポンスは 1〜3 秒。
# (connect_timeout, read_timeout) 形式で設定。
REQUEST_TIMEOUT = (5, 15)

BASE_URL = "https://teket.jp"
API_URL = f"{BASE_URL}/api/events"

# 検索キーワード × カテゴリの組み合わせ
# 注意: teket API は1セッションで複数クエリを連続実行するとレートリミットし
# 応答をドリップ配信して無限待ちになる。1クエリのみ使用し、
# MAX_PAGES_PER_QUERY × 10件 = 最大50件を取得する。
SEARCH_CONFIGS = [
    {"word": "ゲーム音楽", "category": "3"},   # 音楽カテゴリ（主要クエリ）
]

MAX_PAGES_PER_QUERY = 5


class ScraperTeket(BaseScraper):
    source_name = "teket"
    source_rank = "B"

    def scrape(self) -> list[dict]:
        seen_urls: set[str] = set()
        results: list[dict] = []

        for cfg in SEARCH_CONFIGS:
            events = self._fetch_events(cfg["word"], cfg["category"], seen_urls)
            results.extend(events)
            time.sleep(SCRAPE_RATE_LIMIT_SEC)

        print(f"[teket] total unique events: {len(results)}")
        return results

    def _fetch_events(
        self, word: str, category: str, seen: set[str]
    ) -> list[dict]:
        results = []
        page = 1

        while page <= MAX_PAGES_PER_QUERY:
            try:
                resp = self.session.get(
                    API_URL,
                    params={"word": word, "category": category, "p": page},
                    timeout=REQUEST_TIMEOUT,
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                print(f"[teket] API error (word={word}, p={page}): {e}")
                break

            items = data.get("list") or []
            if not items:
                break

            for item in items:
                url = item.get("url") or ""
                if not url or url in seen:
                    continue
                seen.add(url)
                event = self._build_event(item)
                if event:
                    results.append(event)

            next_page = data.get("next_page")
            if not next_page:
                break
            page = int(next_page)
            time.sleep(SCRAPE_RATE_LIMIT_SEC)

        return results

    def _build_event(self, item: dict) -> dict | None:
        url = item.get("url") or ""
        if not url:
            return None

        raw_text = self._format_raw_text(item)
        if not raw_text:
            return None

        # チラシ画像: flyer フィールドは相対パス
        flyer = item.get("flyer") or ""
        image_url = (BASE_URL + flyer) if flyer else None

        return {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_text": raw_text,
            "image_url": image_url,
            "ticket_url": url,  # teket URL はそのままチケット購入ページ
        }

    def _format_raw_text(self, item: dict) -> str | None:
        lines = []

        if item.get("event_name"):
            lines.append(f"イベント名: {item['event_name']}")
        if item.get("group_name"):
            lines.append(f"主催者: {item['group_name']}")
        if item.get("event_date"):
            lines.append(f"開催日: {item['event_date']}")
        if item.get("start"):
            lines.append(f"開始: {item['start']}")
        if item.get("close"):
            lines.append(f"終了: {item['close']}")
        if item.get("theater"):
            lines.append(f"会場: {item['theater']}")
        if item.get("region"):
            lines.append(f"地域: {item['region']}")
        if item.get("catch_copy"):
            lines.append(f"キャッチコピー: {item['catch_copy']}")
        if item.get("summary_program"):
            lines.append(f"プログラム概要: {item['summary_program']}")
        if item.get("url"):
            lines.append(f"チケットURL: {item['url']}")

        return "\n".join(lines) if lines else None
