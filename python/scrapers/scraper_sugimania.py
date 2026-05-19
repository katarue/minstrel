"""
sugimania.com スクレイパー。
すぎやまこういちの世界 - 最新コンサート情報を収集する。
https://sugimania.com/concert.html

静的 HTML（Shift-JIS）、robots.txt なし。
ソースランク A（スギヤマ工房公式、ドラゴンクエスト系コンサートの最高信頼度ソース）。
"""

import re

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from processor.structured_parser import build_iso8601, region_to_prefecture, game_titles_from_text

BASE_URL = "https://sugimania.com"
CONCERT_URL = f"{BASE_URL}/concert.html"
REQUEST_TIMEOUT = (5, 15)

_DATE_RE = re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日")
_TIME_RE = re.compile(r"(\d{1,2}:\d{2})開演")


class ScraperSugimania(BaseScraper):
    source_name = "sugimania"
    source_rank = "A"

    def scrape(self) -> list[dict]:
        resp = self.session.get(CONCERT_URL, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        resp.encoding = "cp932"
        soup = BeautifulSoup(resp.text, "html.parser")

        tables = soup.select("table.concertInfo")
        print(f"[sugimania] found {len(tables)} concerts")

        results = [e for t in tables if (e := self._parse_table(t))]
        print(f"[sugimania] parsed: {len(results)} events")
        return results

    def _parse_table(self, table) -> dict | None:
        table_id = table.get("id", "")
        source_url = f"{CONCERT_URL}#{table_id}" if table_id else CONCERT_URL

        # タイトル
        title_el = table.select_one("td.concertTitle p")
        title = title_el.get_text(" ", strip=True) if title_el else None
        if not title:
            return None

        # 日付・時刻・会場（<span class="date"> を含む <td>）
        date_td = table.select_one("span.date")
        date_str = None
        time_str = None
        venue = None

        if date_td:
            date_text = date_td.get_text(strip=True)
            m = _DATE_RE.search(date_text)
            if m:
                y, mo, d = m.groups()
                date_str = f"{y}-{int(mo):02d}-{int(d):02d}"

            # 開演時刻は span の親 <p> のテキスト全体から取る
            parent_p = date_td.find_parent("p")
            if parent_p:
                p_text = parent_p.get_text(" ", strip=True)
                tm = _TIME_RE.search(p_text)
                if tm:
                    time_str = tm.group(1)

                # 会場: ■ 直後の <a> タグ、なければ ■ 以降テキスト
                venue_a = parent_p.find("a")
                if venue_a:
                    venue = venue_a.get_text(strip=True)
                elif "■" in p_text:
                    after = p_text.split("■", 1)[-1].strip()
                    venue = after.split()[0] if after else None

        start_dt = build_iso8601(date_str, time_str)

        # フライヤー画像（拡大版 href を使用）
        img_a = table.select_one("td.img a[href]")
        image_url = None
        if img_a:
            href = img_a["href"]
            if href and not href.startswith("#"):
                image_url = href if href.startswith("http") else BASE_URL + href

        prefecture = region_to_prefecture("", venue or "")
        titles = game_titles_from_text(f"{title} {table.get_text(' ', strip=True)}")

        pre_parsed = {
            "title": title,
            "start_datetime": start_dt,
            "end_datetime": None,
            "venue": venue,
            "prefecture": prefecture,
            "organizer_name": "スギヤマ工房",
            "organizer_official_url": BASE_URL,
            "ticket_url": None,
            "description": None,
            "game_titles": titles or ["ドラゴンクエスト"],
            "is_cancelled": False,
            "source_url": source_url,
        }

        return {
            "source_url": source_url,
            "source_name": self.source_name,
            "source_rank": self.source_rank,
            "raw_text": self._build_raw_text(title, date_str, time_str, venue, table),
            "image_url": image_url,
            "_pre_parsed": pre_parsed,
        }

    def _build_raw_text(self, title, date_str, time_str, venue, table) -> str:
        lines = []
        if title:
            lines.append(f"イベント名: {title}")
        if date_str:
            t = f" {time_str}開演" if time_str else ""
            lines.append(f"開催日: {date_str}{t}")
        if venue:
            lines.append(f"会場: {venue}")
        full = table.get_text(" ", strip=True)
        lines.append(f"\n詳細:\n{full[:1200]}")
        return "\n".join(lines)
