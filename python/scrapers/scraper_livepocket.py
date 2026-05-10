"""
LivePocket スクレイパー。
https://livepocket.jp/event/search でゲーム音楽コンサート情報を収集する。

検索・詳細ページともに静的 HTML のため requests で取得可能。
teket（t.livepocket.jp）と同じ親サービスだが、別 URL として独立掲載される。

robots.txt 確認済み: /e/ および /event/ は禁止対象外。
ソースランク B（中規模プラットフォーム）。
"""

import time
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
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

_SKIP_DOMAINS = {
    "livepocket.jp",
    "livepocket.co.jp",
    "google.com",
    "maps.google.com",
    "apple.com",
    "facebook.com",
    "fb.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "youtube.com",
    "youtu.be",
    "line.me",
    "lin.ee",
    "tiktok.com",
}

_SKIP_PATH_PREFIXES = (
    "/intent/", "/share", "/sharer", "/oauth",
)


def _is_x_account_url(href: str) -> bool:
    parsed = urlparse(href)
    domain = parsed.netloc.lstrip("www.")
    if domain not in ("twitter.com", "x.com"):
        return False
    path = parsed.path
    if any(path.startswith(p) for p in _SKIP_PATH_PREFIXES):
        return False
    segments = [s for s in path.split("/") if s]
    return len(segments) == 1


def _is_skip_domain(href: str) -> bool:
    try:
        domain = urlparse(href).netloc.lstrip("www.")
        return any(domain == s or domain.endswith("." + s) for s in _SKIP_DOMAINS)
    except Exception:
        return True


def _extract_urls_from_soup(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    x_url: str | None = None
    official_url: str | None = None
    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if not href.startswith("http"):
            continue
        if _is_x_account_url(href):
            if not x_url:
                x_url = href
        elif not _is_skip_domain(href) and not official_url:
            official_url = href
    return x_url, official_url


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
        x_url, official_url = _extract_urls_from_soup(soup)

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
            "_organizer_x_url": x_url,
            "_organizer_official_url": official_url,
        }
