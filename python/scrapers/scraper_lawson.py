"""
ローソンチケット スクレイパー。
https://l-tike.com/search/ でゲーム音楽コンサート情報を収集する。

Cloudflare 対策のため curl_cffi（Chromium TLS フィンガープリント模倣）を使用。
robots.txt 確認済み: /search/ および /*/mevent/ は禁止対象外。
ソースランク A（公式チケット販売 = 開催確定・情報精度が高い）。
"""

import time
from urllib.parse import urlparse, urljoin

from bs4 import BeautifulSoup
from curl_cffi import requests as cffi_requests

from scrapers.base import BaseScraper
from utils.config import SCRAPE_RATE_LIMIT_SEC, USER_AGENT

BASE_URL = "https://l-tike.com"
SEARCH_QUERIES = [
    f"{BASE_URL}/search/?keyword=%E3%82%B2%E3%83%BC%E3%83%A0+%E3%82%B3%E3%83%B3%E3%82%B5%E3%83%BC%E3%83%88&genre=1",
]

_SKIP_DOMAINS = {
    "l-tike.com",
    "ent.lawson.co.jp",
    "lawson.co.jp",
    "hmv.co.jp",
    "img.hmv.co.jp",
    "entm.auone.jp",
    "google.com",
    "maps.google.com",
    "apple.com",
    "facebook.com",
    "fb.com",
    "twitter.com",   # x_url として取れないものはスキップ
    "x.com",
    "instagram.com",
    "youtube.com",
    "youtu.be",
    "line.me",
    "lin.ee",
    "tiktok.com",
    "engekisengen.com",
    "engekisaikyoron.net",
    "crank-in.net",
    "unitedcinemas.jp",
    "ftaj.jp",
    "acpc.or.jp",
    "tenbai-no.jp",
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
