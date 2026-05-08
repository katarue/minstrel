from bs4 import BeautifulSoup
from scrapers.base import BaseScraper

BASE_URL = "https://www.2083.jp"
CONCERT_LIST_URL = f"{BASE_URL}/concert/"


class Scraper2083Web(BaseScraper):
    source_name = "2083web"
    source_rank = "B"

    def scrape(self) -> list[dict]:
        html = self._fetch_decoded(CONCERT_LIST_URL)
        soup = BeautifulSoup(html, "lxml")
        events = []

        # /concert/ 配下の個別ページリンクを収集
        for a in soup.select("a[href^='/concert/']"):
            href = a.get("href", "")
            if href in ("/concert/", "") or not href.endswith(".html"):
                continue
            detail_url = f"{BASE_URL}{href}"
            event = self._scrape_detail(detail_url)
            if event:
                events.append(event)

        return events

    def _scrape_detail(self, url: str) -> dict | None:
        html = self._fetch_decoded(url)
        soup = BeautifulSoup(html, "lxml")

        # タイトル・日時・会場はページごとに構造が異なる可能性があるため
        # raw_html を Claude API に渡して構造化抽出する方針
        main = soup.select_one("main") or soup.select_one("body")
        if not main:
            return None

        return {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_html": str(main)[:8000],
        }

    def _fetch_decoded(self, url: str) -> str:
        """Shift-JIS / UTF-8 を自動判定してデコードする fetch。"""
        import time
        from utils.config import SCRAPE_RATE_LIMIT_SEC
        time.sleep(SCRAPE_RATE_LIMIT_SEC)
        resp = self.session.get(url, timeout=15)
        resp.raise_for_status()
        # chardet に任せず、apparent_encoding で判定
        resp.encoding = resp.apparent_encoding
        return resp.text
