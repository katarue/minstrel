"""
チケットぴあ スクレイパー。
https://t.pia.jp/pia/search_all.do でゲーム音楽コンサート情報を収集する。

検索結果は JavaScript レンダリングのため Playwright を使用。
詳細ページは静的 HTML のため requests で取得。

robots.txt 確認済み: 検索・イベントページは禁止対象外。
ソースランク A（公式チケット販売 = 開催確定・情報精度が高い）。
"""

import re
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from scrapers.base import BaseScraper
from utils.config import SCRAPE_RATE_LIMIT_SEC, USER_AGENT
from processor.structured_parser import build_iso8601, region_to_prefecture, game_titles_from_text

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


def _parse_pia_structured(soup: BeautifulSoup, url: str) -> dict | None:
    """ぴあ詳細ページのHTMLから構造化データを抽出する。
    title と start_datetime が取得できない場合は None を返す（Claude フォールバック）。
    """
    # ── タイトル: og:title から " | チケットぴあ..." 以降を除去 ────────
    title = None
    og_title = soup.find("meta", property="og:title")
    if og_title:
        raw_title = og_title.get("content", "")
        title = re.sub(r'\s*\|.*$', '', raw_title).strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True) or None

    # ── dl > dt/dd 構造から日時・会場・主催を取得 ─────────────────────
    date_str = None
    time_str = None
    venue = None
    prefecture = None
    organizer_name = None

    for dt in soup.find_all("dt"):
        dt_text = dt.get_text(strip=True)
        dd = dt.find_next_sibling("dd")
        if not dd:
            continue
        dd_text = dd.get_text(separator=" ", strip=True)

        if "開催日時" in dt_text or "公演日時" in dt_text or "公演期間" in dt_text:
            # 最初の YYYY/M/D を直接抽出（括弧内の曜日・祝日表記を無視）
            m_date = re.search(r'(\d{4}/\d{1,2}/\d{1,2})', dd_text)
            if m_date:
                try:
                    d = datetime.strptime(m_date.group(1), "%Y/%m/%d")
                    date_str = d.strftime("%Y-%m-%d")
                except ValueError:
                    pass
            # 時刻: "18:00" 等を抽出（あれば）
            m_time = re.search(r'(\d{1,2}:\d{2})', dd_text)
            if m_time:
                time_str = m_time.group(1)

        elif "会場" in dt_text and "問い合わせ" not in dt_text:
            # "会場名\xa0(都道府県)" 形式
            pref_match = re.search(r'[（(]([^）)]+)[）)]', dd_text)
            if pref_match:
                pref_raw = pref_match.group(1)
                prefecture = region_to_prefecture(pref_raw, "") or pref_raw or None
                venue = re.sub(r'\s*[（(][^）)]+[）)]', '', dd_text).replace('\xa0', '').strip() or None
            else:
                venue = dd_text.replace('\xa0', '').strip() or None

        elif "主催" in dt_text:
            organizer_name = dd_text or None

    start_dt = build_iso8601(date_str or "", time_str or "")

    if not title or not start_dt:
        return None

    # ── ゲームタイトル・description ─────────────────────────────────────
    titles = game_titles_from_text(title)

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

        pre_parsed = _parse_pia_structured(soup, url)

        og_image = soup.find("meta", attrs={"property": "og:image"})
        image_url = og_image.get("content") if og_image else None
        if image_url:
            print(f"[pia] image found: {image_url[:80]}")

        result = {
            "source_url": url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_text": raw_text,
            "ticket_url": url,
            "image_url": image_url,
        }
        if pre_parsed:
            result["_pre_parsed"] = pre_parsed
        return result
