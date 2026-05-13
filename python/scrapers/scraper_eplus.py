"""
e+(イープラス) スクレイパー。
https://eplus.jp/sf/live/game-music からゲーム音楽コンサート情報を収集する。

robots.txt 確認済み: /sf/live/ は禁止対象外（/sf/search 等のみ禁止）。
ソースランク A（公式チケット販売 = 開催確定・情報精度が高い）。
"""

import re
import time
from datetime import datetime
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from scrapers.url_utils import collect_x_url, collect_candidate_official_urls
from utils.config import SCRAPE_RATE_LIMIT_SEC
from processor.structured_parser import build_iso8601, game_titles_from_text

BASE_URL = "https://eplus.jp"
LIST_URL = f"{BASE_URL}/sf/live/game-music"


def _parse_eplus_structured(soup: BeautifulSoup, url: str) -> dict | None:
    """e+ 詳細ページのHTMLから構造化データを抽出する。
    title と start_datetime が取得できない場合は None を返す（Claude フォールバック）。
    """
    # ── タイトル ─────────────────────────────────────────────────────
    title = None
    h1 = soup.find("h1", class_="s4-main-title")
    if h1:
        title = h1.get_text(separator="\n", strip=True).split("\n")[0].strip()
    if not title:
        og_title = soup.find("meta", property="og:title")
        if og_title:
            raw_title = og_title.get("content", "")
            title = re.sub(r'のチケット情報.*$', '', raw_title).strip()

    # ── 日付・時刻 ────────────────────────────────────────────────────
    date_str = None
    date_el = soup.find("span", class_="block-ticket-article__date")
    if date_el:
        date_raw = date_el.get_text(strip=True)
        date_clean = re.sub(r'\([^)]+\)', '', date_raw).strip()  # "2026/5/16(土)" → "2026/5/16"
        try:
            d = datetime.strptime(date_clean, "%Y/%m/%d")
            date_str = d.strftime("%Y-%m-%d")
        except ValueError:
            pass

    time_str = None
    time_el = soup.find("span", class_="block-ticket-article__time")
    if time_el:
        time_raw = time_el.get_text(strip=True)
        m = re.search(r'開演[：:]\s*(\d{1,2}:\d{2})', time_raw)
        if m:
            time_str = m.group(1)

    start_dt = build_iso8601(date_str or "", time_str or "")

    if not title or not start_dt:
        return None

    # ── 会場・都道府県 ─────────────────────────────────────────────────
    venue = None
    venue_el = soup.find("span", class_="block-ticket-article__venue")
    if venue_el:
        venue = venue_el.get_text(strip=True) or None

    prefecture = None
    pref_el = soup.find("small", class_="block-ticket-article__region")
    if pref_el:
        pref_clean = re.sub(r'[（）()]', '', pref_el.get_text(strip=True)).strip()
        prefecture = pref_clean or None

    # ── 主催者（dl > dt "主催" の隣の dd）────────────────────────────
    organizer_name = None
    for dt in soup.find_all("dt"):
        if "主催" in dt.get_text():
            dd = dt.find_next_sibling("dd")
            if dd:
                organizer_name = dd.get_text(strip=True) or None
                break

    # ── ゲームタイトル ────────────────────────────────────────────────
    titles = game_titles_from_text(title)

    # ── description: テンプレート生成 ────────────────────────────────
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
        "game_titles": titles,
        "is_cancelled": False,
        "source_url": url,
    }


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

        pre_parsed = _parse_eplus_structured(soup, url)

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
