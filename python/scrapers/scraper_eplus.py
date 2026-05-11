"""
e+(イープラス) スクレイパー。
https://eplus.jp/sf/live/game-music からゲーム音楽コンサート情報を収集する。

robots.txt 確認済み: /sf/live/ は禁止対象外（/sf/search 等のみ禁止）。
ソースランク A（公式チケット販売 = 開催確定・情報精度が高い）。
"""

import time
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from scrapers.url_utils import collect_x_url, collect_candidate_official_urls
from utils.config import SCRAPE_RATE_LIMIT_SEC

BASE_URL = "https://eplus.jp"
LIST_URL = f"{BASE_URL}/sf/live/game-music"


class ScraperEplus(BaseScraper):
    source_name = "eplus"
    source_rank = "A"

    def scrape(self) -> list[dict]:
        try:
            html = self.fetch(LIST_URL)
        except Exception as e:
            print(f"[eplus] list page error: {e}")
            return []

        soup = BeautifulSoup(html, "lxml")

        # 詳細ページのURLを重複なく収集
        seen: set[str] = set()
        detail_urls: list[str] = []
        for a in soup.find_all("a", href=True):
            href: str = a["href"]
            if "/sf/detail/" not in href:
                continue
            full = urljoin(BASE_URL, href)
            # クエリパラメータを除いた URL でユニーク判定
            base_path = full.split("?")[0]
            if base_path not in seen:
                seen.add(base_path)
                detail_urls.append(full)

        print(f"[eplus] found {len(detail_urls)} detail pages")

        results: list[dict] = []
        for url in detail_urls:
            event = self._scrape_detail(url)
            if event:
                results.append(event)
            time.sleep(SCRAPE_RATE_LIMIT_SEC)

        print(f"[eplus] scraped {len(results)} events")
        return results

    def _scrape_detail(self, url: str) -> dict | None:
        try:
            html = self.fetch(url)
        except Exception as e:
            print(f"[eplus] detail error {url}: {e}")
            return None

        soup = BeautifulSoup(html, "lxml")

        # 不要なスクリプト・スタイルを除去してテキスト抽出
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        raw_text = soup.get_text(separator="\n", strip=True)

        # 長すぎる場合は先頭3000文字に制限
        if len(raw_text) > 3000:
            raw_text = raw_text[:3000]

        if not raw_text:
            return None

        x_url = collect_x_url(soup)
        candidate_urls = collect_candidate_official_urls(soup)
        if candidate_urls:
            raw_text += "\n\n【外部リンク候補】\n" + "\n".join(candidate_urls)

        og_image = soup.find("meta", property="og:image")
        image_url = og_image["content"] if og_image and og_image.get("content") else None

        return {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_text": raw_text,
            "ticket_url": url,
            "image_url": image_url,
            "_organizer_x_url": x_url,
        }
