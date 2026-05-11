"""
ローソンチケット スクレイパー。
https://l-tike.com/search/ でゲーム音楽コンサート情報を収集する。

Cloudflare 対策のため curl_cffi（Chromium TLS フィンガープリント模倣）を使用。
robots.txt 確認済み: /search/ および /*/mevent/ は禁止対象外。
ソースランク A（公式チケット販売 = 開催確定・情報精度が高い）。
"""

import time
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from curl_cffi import requests as cffi_requests

from scrapers.base import BaseScraper
from scrapers.url_utils import collect_x_url, collect_candidate_official_urls
from utils.config import SCRAPE_RATE_LIMIT_SEC, USER_AGENT

BASE_URL = "https://l-tike.com"

def _q(kw: str) -> str:
    from urllib.parse import quote
    return f"{BASE_URL}/search/?keyword={quote(kw)}&genre=1"

SEARCH_QUERIES = [
    _q("ゲーム音楽"),
    _q("ゲームミュージック"),
    _q("ゲーム オーケストラ"),
    _q("ゲーム 吹奏楽"),
    _q("ゲーム 演奏会"),
    _q("ゲーム コンサート"),
]



class ScraperLawson(BaseScraper):
    source_name = "lawson"
    source_rank = "A"

    def scrape(self) -> list[dict]:
        seen: set[str] = set()
        detail_urls: list[str] = []

        for search_url in SEARCH_QUERIES:
            try:
                r = cffi_requests.get(search_url, impersonate="chrome", timeout=15)
                r.raise_for_status()
            except Exception as e:
                print(f"[lawson] search error {search_url}: {e}")
                continue

            soup = BeautifulSoup(r.text, "lxml")
            for a in soup.find_all("a", href=True):
                href: str = a["href"]
                if "mevent" not in href:
                    continue
                full = href if href.startswith("http") else urljoin(BASE_URL, href)
                # mid パラメータでユニーク判定
                mid = ""
                if "mid=" in full:
                    for param in full.split("?")[-1].split("&"):
                        if param.startswith("mid="):
                            mid = param
                            break
                key = mid or full
                if key not in seen:
                    seen.add(key)
                    detail_urls.append(full)

            time.sleep(SCRAPE_RATE_LIMIT_SEC)

        print(f"[lawson] found {len(detail_urls)} detail pages")

        results: list[dict] = []
        for url in detail_urls:
            event = self._scrape_detail(url)
            if event:
                results.append(event)
            time.sleep(SCRAPE_RATE_LIMIT_SEC)

        print(f"[lawson] scraped {len(results)} events")
        return results

    def _scrape_detail(self, url: str) -> dict | None:
        try:
            r = cffi_requests.get(url, impersonate="chrome", timeout=15)
            r.raise_for_status()
        except Exception as e:
            print(f"[lawson] detail error {url}: {e}")
            return None

        soup = BeautifulSoup(r.text, "lxml")
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
