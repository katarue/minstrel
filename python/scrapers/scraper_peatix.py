"""
Peatix スクレイパー。
https://peatix.com/search でゲーム音楽コンサート情報を収集する。

検索・詳細ページともに JS レンダリングのため Playwright を使用。
1ブラウザインスタンスでページを順次処理する。

robots.txt 確認済み: /search/ および /event/ は禁止対象外。
ソースランク B（中規模プラットフォーム、情報精度は高いが確認推奨）。
"""

import time
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, Browser

from scrapers.base import BaseScraper
from utils.config import SCRAPE_RATE_LIMIT_SEC, USER_AGENT

def _q(kw: str) -> str:
    from urllib.parse import quote
    return f"https://peatix.com/search?q={quote(kw)}&l=ja"

SEARCH_URLS = [
    _q("ゲーム音楽"),
    _q("ゲームミュージック"),
    _q("ゲーム オーケストラ"),
    _q("ゲーム コンサート"),
]

_SKIP_DOMAINS = {
    "peatix.com",
    "ptix.co",
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
    "cookiepro.com",
    "onetrust.com",
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


class ScraperPeatix(BaseScraper):
    source_name = "peatix"
    source_rank = "A"

    def scrape(self) -> list[dict]:
        results: list[dict] = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(
                user_agent=USER_AGENT,
                locale="ja-JP",
            )

            detail_urls = self._fetch_search_links(ctx)
            print(f"[peatix] found {len(detail_urls)} detail pages")

            for url in detail_urls:
                event = self._scrape_detail(ctx, url)
                if event:
                    results.append(event)
                time.sleep(SCRAPE_RATE_LIMIT_SEC)

            browser.close()

        print(f"[peatix] scraped {len(results)} events")
        return results

    def _fetch_search_links(self, ctx) -> list[str]:
        seen: set[str] = set()
        urls: list[str] = []

        for search_url in SEARCH_URLS:
            page = ctx.new_page()
            try:
                page.goto(search_url, timeout=30000)
                page.wait_for_selector('a[href*="/event/"]', timeout=15000)
                content = page.content()
            except Exception as e:
                print(f"[peatix] search error {search_url}: {e}")
                page.close()
                continue
            finally:
                page.close()

            soup = BeautifulSoup(content, "lxml")
            for a in soup.find_all("a", href=True):
                href: str = a["href"]
                if "/event/" not in href or "peatix.com" not in href:
                    continue
                base = href.split("?")[0]
                if base not in seen:
                    seen.add(base)
                urls.append(base)

        return urls

    def _scrape_detail(self, ctx, url: str) -> dict | None:
        page = ctx.new_page()
        try:
            page.goto(url, timeout=30000)
            page.wait_for_selector("h1", timeout=12000)
            content = page.content()
        except Exception as e:
            print(f"[peatix] detail error {url}: {e}")
            return None
        finally:
            page.close()

        soup = BeautifulSoup(content, "lxml")
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
