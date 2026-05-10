"""
チケットぴあ スクレイパー。
https://t.pia.jp/pia/search_all.do でゲーム音楽コンサート情報を収集する。

検索結果は JavaScript レンダリングのため Playwright を使用。
詳細ページは静的 HTML のため requests で取得。

robots.txt 確認済み: 検索・イベントページは禁止対象外。
ソースランク A（公式チケット販売 = 開催確定・情報精度が高い）。
"""

import time

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from scrapers.base import BaseScraper
from utils.config import SCRAPE_RATE_LIMIT_SEC, USER_AGENT

DETAIL_BASE = "https://ticket.pia.jp"

def _q(kw: str) -> str:
    from urllib.parse import quote
    return f"https://t.pia.jp/pia/search_all.do?kw={quote(kw)}&ct_l1=1"

SEARCH_URLS = [
    _q("ゲーム音楽"),
    _q("ゲームミュージック"),
    _q("ゲーム オーケストラ"),
    _q("ゲーム 吹奏楽"),
    _q("ゲーム 演奏会"),
]


class ScraperPia(BaseScraper):
    source_name = "pia"
    source_rank = "A"

    def scrape(self) -> list[dict]:
        detail_urls = self._fetch_search_links()
        print(f"[pia] found {len(detail_urls)} detail pages")

        results: list[dict] = []
        session = requests.Session()
        session.headers.update({"User-Agent": USER_AGENT})

        for url in detail_urls:
            event = self._scrape_detail(session, url)
            if event:
                results.append(event)
            time.sleep(SCRAPE_RATE_LIMIT_SEC)

        print(f"[pia] scraped {len(results)} events")
        return results

    def _fetch_search_links(self) -> list[str]:
        """Playwright でゲーム音楽コンサートの検索結果ページからイベントリンクを収集する。"""
        seen: set[str] = set()
        urls: list[str] = []

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                for search_url in SEARCH_URLS:
                    page = browser.new_page(user_agent=USER_AGENT)
                    try:
                        page.goto(search_url, timeout=45000)
                        page.wait_for_load_state("domcontentloaded", timeout=15000)
                        content = page.content()
                    except Exception as e:
                        print(f"[pia] playwright error {search_url}: {e}")
                        continue
                    finally:
                        page.close()
                    self._extract_links(content, seen, urls)
                    time.sleep(SCRAPE_RATE_LIMIT_SEC)
                browser.close()
        except Exception as e:
            print(f"[pia] playwright error: {e}")

        return urls

    def _extract_links(self, content: str, seen: set, urls: list) -> None:
        soup = BeautifulSoup(content, "lxml")
        for a in soup.find_all("a", href=True):
            href: str = a["href"]
            if "ticketInformation" not in href and "eventCd=" not in href:
                continue
            if not href.startswith("http"):
                href = DETAIL_BASE + href
            # クエリパラメータから eventCd のみで正規化
            base = href.split("?")[0]
            event_cd = ""
            for param in href.split("?")[-1].split("&"):
                if param.startswith("eventCd="):
                    event_cd = param
                    break
            key = f"{base}?{event_cd}" if event_cd else base
            if key not in seen:
                seen.add(key)
                urls.append(href)

    def _scrape_detail(self, session: requests.Session, url: str) -> dict | None:
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
        except Exception as e:
            print(f"[pia] detail error {url}: {e}")
            return None

        soup = BeautifulSoup(resp.text, "lxml")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        raw_text = soup.get_text(separator="\n", strip=True)
        if len(raw_text) > 3000:
            raw_text = raw_text[:3000]

        if not raw_text:
            return None

        return {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_text": raw_text,
            "ticket_url": url,
        }
