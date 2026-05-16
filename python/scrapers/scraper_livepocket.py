"""
LivePocket スクレイパー。
https://livepocket.jp/event/search でゲーム音楽コンサート情報を収集する。

検索・詳細ページともに静的 HTML のため requests で取得可能。
teket（t.livepocket.jp）と同じ親サービスだが、別 URL として独立掲載される。

robots.txt 確認済み: /e/ および /event/ は禁止対象外。
ソースランク B（中規模プラットフォーム）。
"""

import re
import time
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from scrapers.url_utils import collect_x_url, collect_candidate_official_urls
from utils.config import SCRAPE_RATE_LIMIT_SEC, USER_AGENT
from processor.structured_parser import build_iso8601, extract_date_time, extract_prefecture

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


def _parse_livepocket_structured(soup: BeautifulSoup, url: str) -> dict | None:
    """LivePocket 詳細ページから構造化データを抽出する。title + start_datetime が取れない場合は None。"""
    # タイトル
    title = None
    og = soup.find("meta", property="og:title")
    if og:
        title = og.get("content", "").strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)

    # 日付・時刻: <time datetime> → テキスト regex
    date_str, time_str = None, None
    time_el = soup.find("time", attrs={"datetime": True})
    if time_el:
        raw = time_el.get("datetime", "")
        m = re.match(r'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})', raw)
        if m:
            date_str, time_str = m.group(1), m.group(2)
    if not date_str:
        date_str, time_str = extract_date_time(soup.get_text())

    start_dt = build_iso8601(date_str or "", time_str or "")
    if not title or not start_dt:
        return None

    # 会場: dt/dd パターン → class 名マッチ
    venue = None
    for dt in soup.find_all("dt"):
        if any(kw in dt.get_text() for kw in ["会場", "場所", "開催場所", "開催地"]):
            dd = dt.find_next_sibling("dd")
            if dd:
                venue = dd.get_text(strip=True) or None
                break
    if not venue:
        for cls_kw in ["venue", "place", "location"]:
            el = soup.find(class_=re.compile(cls_kw, re.I))
            if el:
                venue = el.get_text(strip=True)[:100] or None
                if venue:
                    break

    # 都道府県
    prefecture = extract_prefecture(venue or soup.get_text()[:2000])

    # 主催者: dt/dd パターン → class 名マッチ
    organizer_name = None
    for dt in soup.find_all("dt"):
        if any(kw in dt.get_text() for kw in ["主催", "オーガナイザー", "主催者"]):
            dd = dt.find_next_sibling("dd")
            if dd:
                organizer_name = dd.get_text(strip=True) or None
                break
    if not organizer_name:
        for cls_kw in ["organizer", "host", "promoter"]:
            el = soup.find(class_=re.compile(cls_kw, re.I))
            if el:
                organizer_name = el.get_text(strip=True)[:100] or None
                if organizer_name:
                    break

    description = None
    if venue and date_str:
        pref_str = f"（{prefecture}）" if prefecture else ""
        description = f"{date_str.replace('-', '/')} {venue}{pref_str}で開催のゲーム音楽コンサート。"

    return {
        "title": title,
        "start_datetime": start_dt,
        "end_datetime": None,
        "venue": venue,
        "prefecture": prefecture,
        "organizer_name": organizer_name,
        "organizer_official_url": None,
        "ticket_url": url,
        "description": description,
        "game_titles": [],
        "is_cancelled": False,
        "source_url": url,
    }


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

        pre_parsed = _parse_livepocket_structured(soup, url)

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

        result = {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_text": raw_text,
            "ticket_url": url,
            "image_url": image_url,
            "_organizer_x_url": x_url,
        }
        if pre_parsed:
            result["_pre_parsed"] = pre_parsed
        return result
