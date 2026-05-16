"""
ローソンチケット スクレイパー。
https://l-tike.com/search/ でゲーム音楽コンサート情報を収集する。

Cloudflare 対策のため curl_cffi（Chromium TLS フィンガープリント模倣）を使用。
robots.txt 確認済み: /search/ および /*/mevent/ は禁止対象外。
ソースランク A（公式チケット販売 = 開催確定・情報精度が高い）。
"""

import re
import time
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from curl_cffi import requests as cffi_requests

from scrapers.base import BaseScraper
from scrapers.url_utils import collect_x_url, collect_candidate_official_urls
from utils.config import SCRAPE_RATE_LIMIT_SEC, USER_AGENT
from processor.structured_parser import build_iso8601, extract_date_time, extract_prefecture

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


def _parse_lawson_structured(soup: BeautifulSoup, url: str) -> dict | None:
    """ローソンチケット詳細ページから構造化データを抽出する。title + start_datetime が取れない場合は None。"""
    # タイトル: og:title のサフィックス（「｜ローソンチケット」等）を除去
    title = None
    og = soup.find("meta", property="og:title")
    if og:
        raw = og.get("content", "").strip()
        title = re.split(r'[|｜]', raw)[0].strip() or raw
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)

    # 日付・時刻: dt/dd テーブル（「開催日時」ラベル）→ テキスト regex
    date_str, time_str = None, None
    for dt in soup.find_all("dt"):
        if any(kw in dt.get_text(strip=True) for kw in ["開催日時", "日程", "公演日"]):
            dd = dt.find_next_sibling("dd")
            if dd:
                dd_text = dd.get_text(strip=True)
                m = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', dd_text)
                if m:
                    date_str = f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
                m = re.search(r'開演[：:\s]*(\d{1,2}):(\d{2})', dd_text)
                if not m:
                    m = re.search(r'(\d{1,2}):(\d{2})', dd_text)
                if m:
                    time_str = f"{m.group(1).zfill(2)}:{m.group(2)}"
            break
    if not date_str:
        date_str, time_str = extract_date_time(soup.get_text())

    start_dt = build_iso8601(date_str or "", time_str or "")
    if not title or not start_dt:
        return None

    # 会場: dt/dd テーブル（「会場」ラベル）
    venue = None
    for dt in soup.find_all("dt"):
        if "会場" in dt.get_text(strip=True):
            dd = dt.find_next_sibling("dd")
            if dd:
                venue = dd.get_text(strip=True) or None
                break

    # 都道府県
    prefecture = extract_prefecture(venue or soup.get_text()[:2000])

    # 主催者: dt/dd テーブル（「主催」ラベル）
    organizer_name = None
    for dt in soup.find_all("dt"):
        if "主催" in dt.get_text(strip=True):
            dd = dt.find_next_sibling("dd")
            if dd:
                organizer_name = dd.get_text(strip=True) or None
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

        pre_parsed = _parse_lawson_structured(soup, url)

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
