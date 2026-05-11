"""
スクレイパー共通の URL 分類ユーティリティ。

official_url の判定は Claude AI に委ねる設計（link-scanning では精度が低いため）。
このモジュールは:
  - X アカウント URL の検出（パターンが明確なので機械判定可）
  - Claude に渡す「候補 URL リスト」の収集（チケット・SNS 系を除外したもの）
のみを担う。
"""

from urllib.parse import urlparse
from bs4 import BeautifulSoup

# チケット販売・SNS・地図・ユーティリティ系（公式サイトではありえないドメイン）
_NON_OFFICIAL_DOMAINS = {
    # チケットサイト
    "eplus.jp", "eplus.co.jp",
    "teket.jp",
    "pia.jp", "ticket.pia.jp",
    "l-tike.com", "l-tike.jp", "ent.lawson.co.jp", "lawson.co.jp",
    "peatix.com", "ptix.co",
    "livepocket.jp", "t.livepocket.jp", "livepocket.co.jp",
    "passmarket.yahoo.co.jp",
    "kokucheese.com",
    # ファンクラブ・会員管理サービス
    "ftaj.jp",
    "fanicon.net",
    "zaiko.io",
    # SNS
    "twitter.com", "x.com",
    "instagram.com",
    "youtube.com", "youtu.be",
    "facebook.com", "fb.com",
    "line.me", "lin.ee",
    "tiktok.com",
    "linkedin.com",
    # マップ・ユーティリティ
    "google.com", "maps.google.com", "maps.app.goo.gl",
    "apple.com",
    "goo.gl",
    # ブログ・メディア
    "note.com",
    "ameblo.jp",
    "yahoo.co.jp",
}

_SKIP_PATH_PREFIXES = ("/intent/", "/share", "/sharer", "/oauth")


def collect_x_url(soup: BeautifulSoup) -> str | None:
    """ページ内の X（Twitter）アカウント URL を返す。共有ボタン等は除外。"""
    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if not href.startswith("http"):
            continue
        try:
            parsed = urlparse(href)
            domain = parsed.netloc.lstrip("www.")
        except Exception:
            continue
        if domain not in ("twitter.com", "x.com"):
            continue
        path = parsed.path
        if any(path.startswith(p) for p in _SKIP_PATH_PREFIXES):
            continue
        segments = [s for s in path.split("/") if s]
        if len(segments) == 1:
            return href
    return None


def collect_candidate_official_urls(soup: BeautifulSoup, limit: int = 8) -> list[str]:
    """
    チケット・SNS 系を除いた外部 URL を収集し Claude の判定材料として返す。
    ドメイン単位でユニーク化し、limit 件に絞る。
    """
    seen_domains: set[str] = set()
    result: list[str] = []
    for a in soup.find_all("a", href=True):
        href: str = a["href"]
        if not href.startswith("http"):
            continue
        try:
            domain = urlparse(href).netloc.lstrip("www.")
        except Exception:
            continue
        if any(domain == d or domain.endswith("." + d) for d in _NON_OFFICIAL_DOMAINS):
            continue
        if domain not in seen_domains:
            seen_domains.add(domain)
            result.append(href)
        if len(result) >= limit:
            break
    return result
