"""
Peatix スクレイパー。
https://peatix.com/search でゲーム音楽コンサート情報を収集する。

検索・詳細ページともに JS レンダリングのため Playwright を使用。
1ブラウザインスタンスでページを順次処理する。

robots.txt 確認済み: /search/ および /event/ は禁止対象外。
ソースランク B（中規模プラットフォーム、情報精度は高いが確認推奨）。
"""

import re
import time

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, Browser

from scrapers.base import BaseScraper
from scrapers.url_utils import collect_x_url, collect_candidate_official_urls
from utils.config import SCRAPE_RATE_LIMIT_SEC, USER_AGENT
from processor.structured_parser import build_iso8601, extract_date_time, extract_prefecture

def _q(kw: str) -> str:
    from urllib.parse import quote
    return f"https://peatix.com/search?q={quote(kw)}&l=ja"

SEARCH_URLS = [
    _q("ゲーム音楽"),
    _q("ゲームミュージック"),
    _q("ゲーム オーケストラ"),
    _q("ゲーム コンサート"),
]


def _parse_peatix_structured(soup: BeautifulSoup, url: str) -> dict | None:
    """Peatix 詳細ページから構造化データを抽出する。title + start_datetime が取れない場合は None。"""
    # タイトル: og:title が最も確実（JS レンダリング後）
    title = None
    og = soup.find("meta", property="og:title")
    if og:
        title = og.get("content", "").strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)

    # 日付・時刻: iCal microformat → <time datetime> → テキスト regex の順で試みる
    date_str, time_str = None, None

    # 1) iCal: <abbr class="dtstart" title="20260601T140000">
    dtstart = soup.find(class_="dtstart") or soup.find(attrs={"itemprop": "startDate"})
    if dtstart:
        raw = dtstart.get("title", "") or dtstart.get("datetime", "") or dtstart.get("content", "")
        m = re.match(r'(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})', raw)
        if m:
            date_str = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
            time_str = f"{m.group(4)}:{m.group(5)}"
        else:
            m = re.match(r'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})', raw)
            if m:
                date_str, time_str = m.group(1), m.group(2)

    # 2) <time datetime="...">
    if not date_str:
        time_el = soup.find("time", attrs={"datetime": True})
        if time_el:
            raw = time_el.get("datetime", "")
            m = re.match(r'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})', raw)
            if m:
                date_str, time_str = m.group(1), m.group(2)

    # 3) テキスト regex
    if not date_str:
        date_str, time_str = extract_date_time(soup.get_text())

    start_dt = build_iso8601(date_str or "", time_str or "")
    if not title or not start_dt:
        return None

    # 会場: itemprop="location" → class 名マッチ
    venue = None
    loc_el = soup.find(attrs={"itemprop": "location"})
    if loc_el:
        name_el = loc_el.find(attrs={"itemprop": "name"}) or loc_el
        venue = name_el.get_text(strip=True) or None
    if not venue:
        for cls_kw in ["venue", "location", "place"]:
            el = soup.find(class_=re.compile(cls_kw, re.I))
            if el:
                venue = el.get_text(strip=True)[:100] or None
                if venue:
                    break

    # 都道府県
    prefecture = extract_prefecture(venue or soup.get_text()[:2000])

    # 主催者: itemprop="organizer" → /group/ リンク
    organizer_name = None
    org_el = soup.find(attrs={"itemprop": "organizer"})
    if org_el:
        name_el = org_el.find(attrs={"itemprop": "name"}) or org_el
        organizer_name = name_el.get_text(strip=True) or None
    if not organizer_name:
        for a in soup.find_all("a", href=re.compile(r'/group/')):
            text = a.get_text(strip=True)
            if text:
                organizer_name = text
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
        x_url = collect_x_url(soup)
        candidate_urls = collect_candidate_official_urls(soup)

        pre_parsed = _parse_peatix_structured(soup, url)

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
