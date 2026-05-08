from bs4 import BeautifulSoup
from scrapers.base import BaseScraper

BASE_URL = "https://www.2083.jp"
CONCERT_LIST_URL = f"{BASE_URL}/concert/"
CONCERT_PREFIX = f"{BASE_URL}/concert/"


class Scraper2083Web(BaseScraper):
    source_name = "2083web"
    source_rank = "B"

    def scrape(self) -> list[dict]:
        html = self._fetch_decoded(CONCERT_LIST_URL)
        soup = BeautifulSoup(html, "lxml")

        # 個別コンサートページのURLを重複なく収集
        # 例: https://www.2083.jp/concert/20260425squareenix.html
        seen = set()
        detail_urls = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if (
                href.startswith(CONCERT_PREFIX)
                and href.endswith(".html")
                and "list" not in href
                and href not in seen
            ):
                seen.add(href)
                detail_urls.append(href)

        events = []
        for url in detail_urls:
            event = self._scrape_detail(url)
            if event:
                events.append(event)

        return events

    def _scrape_detail(self, url: str) -> dict | None:
        html = self._fetch_decoded(url)
        soup = BeautifulSoup(html, "lxml")

        # 2083.jp のコンテンツ構造: #containerArea > #container > #left
        content = (
            soup.select_one("#left")
            or soup.select_one("#container")
            or soup.select_one("#containerArea")
            or soup.select_one("body")
        )
        if not content:
            return None

        return {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_html": str(content)[:8000],
        }

    def _fetch_decoded(self, url: str) -> str:
        import time
        from utils.config import SCRAPE_RATE_LIMIT_SEC
        time.sleep(SCRAPE_RATE_LIMIT_SEC)
        resp = self.session.get(url, timeout=15)
        resp.raise_for_status()
        # 2083.jp は Shift-JIS。apparent_encoding では誤検知するため明示指定
        try:
            return resp.content.decode("shift_jis")
        except UnicodeDecodeError:
            return resp.content.decode("cp932", errors="replace")
