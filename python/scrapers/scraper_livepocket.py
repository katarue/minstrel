"""
LivePocket スクレイパー。
https://livepocket.jp/event/search でゲーム音楽コンサート情報を収集する。

検索・詳細ページともに静的 HTML のため requests で取得可能。
teket（t.livepocket.jp）と同じ親サービスだが、別 URL として独立掲載される。

robots.txt 確認済み: /e/ および /event/ は禁止対象外。
ソースランク B（中規模プラットフォーム）。
"""

import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from scrapers.url_utils import collect_x_url, collect_candidate_official_urls
from utils.config import SCRAPE_RATE_LIMIT_SEC, USER_AGENT

BASE_URL = "https://livepocket.jp"

def _q(kw: str) -> str:
    from urllib.parse import quote
    return f"{BASE_URL}/event/search?query={quote(kw)}"

SEARCH_URLS = [
    _q("ゲーム音楽"),
    _q("ゲームミュージック"),
    _q("GAME MUSIC"),
    _q("ゲーム 演奏会"),
    _q("ゲーム コンサート"),
]



class ScraperLivepocket(BaseScraper):
    source_name = "livepocket"
    source_rank = "A"

    def scrape(self) -> list[dict]:
        seen: set[str] = set()
        detail_urls: list[str] = []

        for search_url in SEARCH_URLS:
            try:
                html = self.fetch(search_url)
            except Exception as e:
                print(f"[livepocket] search error {search_url}: {e}")
                continue

            soup = BeautifulSoup(html, "lxml")
            for a in soup.find_all("a", href=True):
                href: str = a["href"]
                if not href.startswith("/e/"):
                    continue
                full = urljoin(BASE_URL, href)
                if full not in seen:
                    seen.add(full)
                    detail_urls.append(full)

        print(f"[livepocket] found {len(detail_urls)} detail pages")

        results: list[dict] = []
        for url in detail_urls:
            event = self._scrape_detail(url)
            if event:
                results.append(event)
            time.sleep(SCRAPE_RATE_LIMIT_SEC)

        print(f"[livepocket] scraped {len(results)} events")
        return results

    def _scrape_detail(self, url: str) -> dict | None:
        try:
            html = self.fetch(url)
        except Exception as e:
            print(f"[livepocket] detail error {url}: {e}")
            return None

        soup = BeautifulSoup(html, "lxml")
        x_url = collect_x_url(soup)
        candidate_urls = collect_candidate_official_urls(soup)

        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        raw_text = soup.get_text(separator="\n", strip=True)
        if len(raw_text) > 3000:
            raw_text = raw_text[:3000]

        if not raw_text:
            return None

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
