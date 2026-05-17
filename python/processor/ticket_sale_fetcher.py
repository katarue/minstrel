"""
チケット発売日スクレイパー。
source_url（チケットサイトのイベントページ）から ticket_sale_start を抽出する。

対応サイト:
  - e+ (eplus.jp)
  - チケットぴあ (t.pia.jp)
  - ローソンチケット (l-tike.com)
  - その他（汎用パターン）
"""

import re
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8",
}

# 一般発売日を示すパターン（優先度順）
_DATE_PATTERNS = [
    r'一般発売[：:\s]*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日',
    r'発売日[：:\s]*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日',
    r'販売開始[：:\s]*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日',
    r'チケット発売[：:\s]*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日',
    r'一般発売[：:\s]*(\d{4})/(\d{1,2})/(\d{1,2})',
    r'発売[：:\s]*(\d{4})/(\d{1,2})/(\d{1,2})',
]


def _extract_sale_date(text: str) -> Optional[str]:
    """テキストから発売日を抽出し YYYY-MM-DD 形式で返す。見つからない場合は None。"""
    for pattern in _DATE_PATTERNS:
        m = re.search(pattern, text)
        if m:
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            try:
                return date(y, mo, d).isoformat()
            except ValueError:
                continue
    return None


def fetch_ticket_sale_date(url: str) -> Optional[str]:
    """1件の URL からチケット発売日を取得して返す。失敗時は None。"""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=10, allow_redirects=True)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.content, "lxml")
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text(separator="\n")
        return _extract_sale_date(text)
    except Exception as e:
        print(f"[ticket_sale] fetch error {url[:60]}: {e}")
        return None
