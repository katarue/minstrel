"""
teket（テケト）スクレイパー。
https://teket.jp/ からゲーム音楽関連のイベント情報を収集する。

robots.txt 確認済み: イベント一覧・詳細ページはスクレイピング許可範囲内。
ソースランク B（チケット発売中 = 開催確定のため、実績確認後に A 昇格可能）。
"""

import time
import re
from bs4 import BeautifulSoup
from scrapers.base import BaseScraper
from utils.config import SCRAPE_RATE_LIMIT_SEC

BASE_URL = "https://teket.jp"

# 検索キーワード × カテゴリの組み合わせ
SEARCH_CONFIGS = [
    {"word": "ゲーム音楽",   "category": "3"},   # 音楽カテゴリ
    {"word": "ゲームミュージック", "category": "3"},
    {"word": "ゲーム音楽",   "category": "11"},  # ゲームカテゴリ
    {"word": "演奏会",       "category": "11"},
]

MAX_PAGES_PER_QUERY = 5


class ScraperTeket(BaseScraper):
    source_name = "teket"
    source_rank = "B"

    def scrape(self) -> list[dict]:
        seen_urls: set[str] = set()
        detail_urls: list[str] = []

        for cfg in SEARCH_CONFIGS:
            urls = self._collect_event_urls(cfg["word"], cfg["category"], seen_urls)
            detail_urls.extend(urls)
            time.sleep(SCRAPE_RATE_LIMIT_SEC)

        print(f"[teket] found {len(detail_urls)} event pages")

        events = []
        for url in detail_urls:
            event = self._scrape_detail(url)
            if event:
                events.append(event)
            time.sleep(SCRAPE_RATE_LIMIT_SEC)

        return events

    # ──────────────────────────────────────────────
    # 一覧ページからイベントURLを収集
    # ──────────────────────────────────────────────
    def _collect_event_urls(
        self, word: str, category: str, seen: set[str]
    ) -> list[str]:
        urls = []
        for page in range(1, MAX_PAGES_PER_QUERY + 1):
            search_url = (
                f"{BASE_URL}/events"
                f"?word={word}&category={category}&p={page}"
            )
            try:
                html = self.fetch(search_url)
            except Exception as e:
                print(f"[teket] fetch error ({search_url}): {e}")
                break

            soup = BeautifulSoup(html, "lxml")
            found = self._extract_event_links(soup)

            if not found:
                break  # 結果なし = 最終ページ超え

            new = [u for u in found if u not in seen]
            seen.update(new)
            urls.extend(new)

            # 次ページリンクがなければ終了
            if not self._has_next_page(soup):
                break

        return urls

    def _extract_event_links(self, soup: BeautifulSoup) -> list[str]:
        """
        一覧ページからイベント詳細ページURLを抽出する。
        teket の URL パターン: /{数字}/{数字}
        """
        pattern = re.compile(r"^/\d+/\d+$")
        found = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if pattern.match(href):
                full_url = BASE_URL + href
                if full_url not in found:
                    found.append(full_url)
        return found

    def _has_next_page(self, soup: BeautifulSoup) -> bool:
        """次ページリンクの有無を確認する。"""
        # 「次へ」や「>」「›」などのページネーションリンクを検出
        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True)
            href = a["href"]
            if ("next" in href.lower() or
                    text in ("次へ", "›", ">", ">>", "次のページ")):
                return True
        return False

    # ──────────────────────────────────────────────
    # 詳細ページのスクレイピング
    # ──────────────────────────────────────────────
    def _scrape_detail(self, url: str) -> dict | None:
        try:
            html = self.fetch(url)
        except Exception as e:
            print(f"[teket] detail fetch error ({url}): {e}")
            return None

        soup = BeautifulSoup(html, "lxml")

        # og:image からチラシ画像を取得
        image_url = self._extract_og_image(soup, url)

        # メインコンテンツを抽出してテキスト化
        raw_text = self._extract_main_text(soup)
        if not raw_text:
            return None

        return {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_text": raw_text,
            "image_url": image_url,
        }

    def _extract_og_image(self, soup: BeautifulSoup, page_url: str) -> str | None:
        # og:image を優先
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return og["content"]

        # /data/flyer/ パスの img を次点とする
        for img in soup.find_all("img", src=True):
            src = img["src"]
            if "/data/flyer/" in src:
                if src.startswith("http"):
                    return src
                return BASE_URL + src

        return None

    def _extract_main_text(self, soup: BeautifulSoup) -> str:
        """
        ページ本文からナビゲーション・フッター等を除いたテキストを返す。
        teket はシングルページアプリ（Next.js）だが、SSR で基本情報は
        <script id="__NEXT_DATA__"> の JSON と本文 HTML の両方に含まれる。
        まず JSON から取得を試み、失敗時は本文テキストにフォールバック。
        """
        # ── Strategy 1: __NEXT_DATA__ JSON から構造化テキストを生成 ──
        next_data = self._parse_next_data(soup)
        if next_data:
            return next_data

        # ── Strategy 2: 本文テキスト（フォールバック） ──
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        return soup.get_text(separator="\n", strip=True)[:4000]

    def _parse_next_data(self, soup: BeautifulSoup) -> str | None:
        """
        <script id="__NEXT_DATA__"> の JSON を解析して
        人間が読めるテキスト形式に変換する。
        """
        import json
        tag = soup.find("script", id="__NEXT_DATA__")
        if not tag:
            return None
        try:
            data = json.loads(tag.string)
            props = data.get("props", {}).get("pageProps", {})

            # teket の API レスポンス構造から必要フィールドを取得
            event = props.get("event") or props.get("eventData") or {}
            if not event:
                return None

            lines = []
            if event.get("name"):
                lines.append(f"イベント名: {event['name']}")
            if event.get("startAt") or event.get("start_at"):
                lines.append(f"開始日時: {event.get('startAt') or event.get('start_at')}")
            if event.get("endAt") or event.get("end_at"):
                lines.append(f"終了日時: {event.get('endAt') or event.get('end_at')}")
            if event.get("place") or event.get("venue"):
                place = event.get("place") or event.get("venue") or {}
                if isinstance(place, dict):
                    lines.append(f"会場: {place.get('name', '')}")
                    lines.append(f"住所: {place.get('address', '')}")
                else:
                    lines.append(f"会場: {place}")
            if event.get("description") or event.get("content"):
                lines.append(f"説明: {event.get('description') or event.get('content')}")

            # 主催者情報
            organizer = props.get("organizer") or event.get("organizer") or {}
            if isinstance(organizer, dict) and organizer.get("name"):
                lines.append(f"主催者: {organizer['name']}")

            # チケット情報
            tickets = event.get("tickets") or []
            prices = [str(t.get("price", 0)) for t in tickets if isinstance(t, dict)]
            if prices:
                lines.append(f"チケット価格: {', '.join(prices)}円")

            return "\n".join(lines) if lines else None

        except (json.JSONDecodeError, AttributeError, TypeError):
            return None
