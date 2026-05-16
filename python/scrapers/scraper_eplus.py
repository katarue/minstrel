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


def _parse_eplus_structured(soup: BeautifulSoup, url: str) -> list[dict] | None:
    """e+ 詳細ページのHTMLから構造化データを抽出する。
    複数公演がある場合は list[dict]（公演数分）を返す。
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

    if not title:
        return None

    # ── 日付・時刻（全公演分）────────────────────────────────────────
    date_els  = soup.find_all("span", class_="block-ticket-article__date")
    time_els  = soup.find_all("span", class_="block-ticket-article__time")
    venue_els = soup.find_all("span", class_="block-ticket-article__venue")
    pref_els  = soup.find_all("small", class_="block-ticket-article__region")

    dates: list[str | None] = []
    for el in date_els:
        date_raw   = el.get_text(strip=True)
        date_clean = re.sub(r'\([^)]+\)', '', date_raw).strip()
        try:
            d = datetime.strptime(date_clean, "%Y/%m/%d")
            dates.append(d.strftime("%Y-%m-%d"))
        except ValueError:
            dates.append(None)

    if not dates:
        return None

    times: list[str | None] = []
    for el in time_els:
        m = re.search(r'開演[：:]\s*(\d{1,2}:\d{2})', el.get_text(strip=True))
        times.append(m.group(1) if m else None)
    while len(times) < len(dates):
        times.append(None)

    # 会場・都道府県は公演数より少ない場合は最初の値を共用
    def _get_text(els, i: int) -> str | None:
        el = els[i] if i < len(els) else (els[0] if els else None)
        return el.get_text(strip=True) or None if el else None

    # ── 主催者（ページ共通）──────────────────────────────────────────
    organizer_name = None
    for dt in soup.find_all("dt"):
        if "主催" in dt.get_text():
            dd = dt.find_next_sibling("dd")
            if dd:
                organizer_name = dd.get_text(strip=True) or None
                break

    titles = game_titles_from_text(title)
    multi  = len(dates) > 1

    results: list[dict] = []
    for i, (date_str, time_str) in enumerate(zip(dates, times)):
        start_dt = build_iso8601(date_str or "", time_str or "")
        if not start_dt:
            continue

        venue  = _get_text(venue_els, i)
        pref_raw = _get_text(pref_els, i)
        prefecture = re.sub(r'[（）()]', '', pref_raw).strip() if pref_raw else None

        # 複数公演の場合は source_url にフラグメントを付与して一意性を保証
        perf_url = f"{url}#perf_{i + 1}" if multi else url

        description = None
        if venue and date_str:
            pref_str = f"（{prefecture}）" if prefecture else ""
            description = f"{date_str.replace('-', '/')} {venue}{pref_str}で開催のゲーム音楽コンサート。"

        results.append({
            "title": title,
            "start_datetime": start_dt,
            "end_datetime": None,
            "venue": venue,
            "prefecture": prefecture,
            "organizer_name": organizer_name,
            "organizer_official_url": None,
            "ticket_url": url,       # 常に元URL（表示・リンク用）
            "description": description,
            "game_titles": titles,
            "is_cancelled": False,
            "source_url": perf_url,  # 複数公演時はフラグメント付きで重複を防ぐ
        })

    return results if results else None


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

        pre_parsed_list = _parse_eplus_structured(soup, url)

        result = {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_text": raw_text,
            "ticket_url": url,
            "image_url": image_url,
            "_organizer_x_url": x_url,
        }
        if pre_parsed_list:
            if len(pre_parsed_list) == 1:
                result["_pre_parsed"] = pre_parsed_list[0]
            else:
                result["_pre_parsed_list"] = pre_parsed_list
        return result
