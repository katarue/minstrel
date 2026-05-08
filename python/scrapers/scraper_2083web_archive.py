"""
2083WEB 過去アーカイブ取得スクリプト（4-B-1）

トップリストページからリンクを辿り、最大 MAX_PAGES ページ分の
コンサートページ URL を収集してスクレイプする。

実行:
  cd python
  PYTHONPATH="." .venv/Scripts/python scrapers/scraper_2083web_archive.py
"""
import time

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper

BASE_URL = "https://www.2083.jp"
CONCERT_LIST_URL = f"{BASE_URL}/concert/"
CONCERT_PREFIX = f"{BASE_URL}/concert/"
MAX_PAGES = 20  # リストページの最大巡回数


class Scraper2083WebArchive(BaseScraper):
    source_name = "2083web"
    source_rank = "B"

    def scrape(self, max_pages: int = MAX_PAGES) -> list[dict]:
        detail_urls = self._collect_all_urls(max_pages)
        print(f"[archive] {len(detail_urls)} concert URLs found")

        events = []
        for i, url in enumerate(detail_urls, 1):
            print(f"[archive] {i}/{len(detail_urls)} {url}")
            event = self._scrape_detail(url)
            if event:
                events.append(event)

        return events

    def _collect_all_urls(self, max_pages: int) -> list[str]:
        """リストページを巡回して全コンサートページ URL を収集する"""
        seen: set[str] = set()
        urls: list[str] = []
        list_url: str | None = CONCERT_LIST_URL

        for page_num in range(max_pages):
            if not list_url:
                break

            print(f"[archive] list page {page_num + 1}: {list_url}")
            html = self._fetch_decoded(list_url)
            soup = BeautifulSoup(html, "lxml")

            # コンサート詳細ページのリンクを収集
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if not href.startswith("http"):
                    href = BASE_URL + "/" + href.lstrip("/")
                if (
                    href.startswith(CONCERT_PREFIX)
                    and href.endswith(".html")
                    and "list" not in href
                    and href not in seen
                ):
                    seen.add(href)
                    urls.append(href)

            # ページネーション: 「次のページ」「次へ」「>>」等を探す
            list_url = self._find_next_page(soup, list_url)

        return urls

    def _find_next_page(self, soup: BeautifulSoup, current_url: str) -> str | None:
        """次ページリンクを探す。見つからなければ None"""
        next_keywords = ["次のページ", "次へ", ">>", "next", "older"]
        for a in soup.find_all("a", href=True):
            text = a.get_text(strip=True).lower()
            href = a["href"]
            if any(kw in text for kw in next_keywords):
                if not href.startswith("http"):
                    href = BASE_URL + "/" + href.lstrip("/")
                if href != current_url:
                    return href
        return None

    def _scrape_detail(self, url: str) -> dict | None:
        html = self._fetch_decoded(url)
        soup = BeautifulSoup(html, "lxml")

        content = (
            soup.select_one("#left")
            or soup.select_one("#container")
            or soup.select_one("#containerArea")
            or soup.select_one("body")
        )
        if not content:
            return None

        image_url = self._extract_image_url(content, url)
        return {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_html": str(content)[:8000],
            "image_url": image_url,
        }

    def _extract_image_url(self, content, page_url: str) -> str | None:
        for img in content.find_all("img"):
            src = img.get("src", "")
            if not src or "/img/hatena" in src or "b.hatena.ne.jp" in src:
                continue
            if src.startswith("http"):
                return src
            if src.startswith("img/"):
                return f"{BASE_URL}/concert/{src}"
            if src.startswith("/"):
                return f"{BASE_URL}{src}"
        return None

    def _fetch_decoded(self, url: str) -> str:
        time.sleep(2.0)  # アーカイブ取得は通常より長めのウェイト
        resp = self.session.get(url, timeout=15)
        resp.raise_for_status()
        try:
            return resp.content.decode("shift_jis")
        except UnicodeDecodeError:
            return resp.content.decode("cp932", errors="replace")


if __name__ == "__main__":
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

    from dotenv import load_dotenv
    load_dotenv()

    scraper = Scraper2083WebArchive()
    events = scraper.scrape(max_pages=MAX_PAGES)
    print(f"\n[archive] scraped {len(events)} events total")
