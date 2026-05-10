"""
e+(イープラス) スクレイパー。
https://eplus.jp/sf/live/game-music からゲーム音楽コンサート情報を収集する。

robots.txt 確認済み: /sf/live/ は禁止対象外（/sf/search 等のみ禁止）。
ソースランク A（公式チケット販売 = 開催確定・情報精度が高い）。
"""

import time
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from utils.config import SCRAPE_RATE_LIMIT_SEC

BASE_URL = "https://eplus.jp"
LIST_URL = f"{BASE_URL}/sf/live/game-music"

# 公式サイトとして扱わないドメイン・パスパターン
_SKIP_DOMAINS = {
    "eplus.jp", "eplus.co.jp",
    "google.com", "maps.google.com", "maps.app.goo.gl",
    "apple.com", "goo.gl",
    "facebook.com", "fb.com",
    "instagram.com",
    "youtube.com", "youtu.be",
    "line.me", "lin.ee",
    "linkedin.com",
    "tiktok.com",
    "note.com",
}
# SNS 共有・OAuth 系パスプレフィックス（ドメインが一致しても除外）
_SKIP_PATH_PREFIXES = (
    "/intent/", "/share", "/sharer", "/oauth",
)


def _is_x_account_url(href: str) -> bool:
    """twitter.com/<username> または x.com/<username> 形式か判定する（共有ボタン除外）。"""
    parsed = urlparse(href)
    domain = parsed.netloc.lstrip("www.")
    if domain not in ("twitter.com", "x.com"):
        return False
    path = parsed.path
    # /intent/ /share /oauth 等は除外
    if any(path.startswith(p) for p in _SKIP_PATH_PREFIXES):
        return False
    # パスが /<username> 形式（1セグメント）であること
    segments = [s for s in path.split("/") if s]
    return len(segments) == 1


def _is_skip_domain(href: str) -> bool:
    try:
        domain = urlparse(href).netloc.lstrip("www.")
        return any(domain == s or domain.endswith("." + s) for s in _SKIP_DOMAINS)
    except Exception:
        return True


def _extract_urls_from_soup(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    """(x_url, official_url) を抽出する。"""
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

        x_url, official_url = _extract_urls_from_soup(soup)

        return {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_text": raw_text,
            "ticket_url": url,
            "_organizer_x_url": x_url,
            "_organizer_official_url": official_url,
        }
