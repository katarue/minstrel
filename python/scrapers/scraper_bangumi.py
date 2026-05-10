"""
番組表.Gガイド（bangumi.org）スクレイパー

地上波・BS・CS の番組表を取得し、ゲーム音楽関連番組をフィルタリングして返す。
- URL: https://bangumi.org/epg/{td|bs|cs}?broad_cast_date=YYYYMMDD
- SSR（requests のみ、Playwright 不要）
- 週1回・2週間分を一括取得する想定
"""
import time
from datetime import datetime, timedelta, timezone

import requests
from bs4 import BeautifulSoup

# チャンネルコード → 局名マッピング
# 地上波: se-id は ARIB サービスID（16進数文字列 "0xNNNN" の形式）
TERRESTRIAL_CH = {
    # 10進数コード
    "011": "NHK総合",    "021": "NHK Eテレ",
    "041": "日本テレビ", "061": "TBS",
    "081": "テレビ朝日", "101": "テレビ東京",
    "121": "フジテレビ", "131": "TOKYO MX",
    # ARIB hex サービスID（bangumi.org が使用する形式）
    "0x0400": "NHK総合",
    "0x0408": "NHK Eテレ",
    "0x0410": "日本テレビ",
    "0x0418": "TBS",
    "0x0420": "フジテレビ",
    "0x0428": "テレビ朝日",
    "0x0430": "テレビ東京",
    "0x0438": "TOKYO MX",
}
# BS
BS_CH = {
    "101": "NHK BS1",
    "103": "NHK BSプレミアム4K",
    "141": "BS日テレ",
    "151": "BS朝日",
    "161": "BS-TBS",
    "171": "BSテレ東",
    "181": "BSフジ",
    "191": "WOWOWプライム",
    "192": "WOWOWライブ",
    "193": "WOWOWシネマ",
    "200": "スター・チャンネル1",
    "211": "BS11",
    "222": "BS12",
    "231": "BSアニマックス",
    "234": "FOXスポーツ&エンタテインメント",
    "236": "J SPORTS 1",
    "238": "J SPORTS 3",
    "240": "J SPORTS 4",
    "242": "日本映画専門チャンネル",
    "294": "ディズニー・チャンネル",
    "298": "カートゥーン ネットワーク",
}

BASE_URL = "https://bangumi.org/epg/{kind}"
GGM_GROUP_ID = "42"  # 関東圏（地上波に必要）

# ゲーム音楽関連キーワード（タイトル・詳細に含まれるもの）
# 誤検知を防ぐため、ゲームと無関係の文脈でも使われる単語は除外する
KEYWORDS = [
    "ゲーム音楽", "ゲームミュージック", "game music",
    "シンフォニック・ゲーマーズ",  # NHK番組
    "ゲームサウンド", "ゲームBGM",
    "ファイナルファンタジー", "ドラゴンクエスト", "ゼルダの伝説",
    "ポケモン コンサート", "マリオ コンサート",
    "クラシック音楽館",  # NHK の定番ゲーム音楽放送枠
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

JST = timezone(timedelta(hours=9))


def _ch_name(se_id: str, ch_map: dict) -> str:
    code = se_id.split("-")[0] if "-" in se_id else se_id
    return ch_map.get(code, f"ch{code}")


def _parse_datetime(s: str) -> str | None:
    """'YYYYMMDDHHmm' → ISO 8601 JST"""
    try:
        dt = datetime.strptime(s, "%Y%m%d%H%M").replace(tzinfo=JST)
        return dt.isoformat()
    except ValueError:
        return None


def _matches_keyword(title: str, detail: str) -> bool:
    text = (title + " " + detail).lower()
    return any(kw.lower() in text for kw in KEYWORDS)


def _fetch_day(kind: str, date: datetime) -> list[dict]:
    """1日分の番組を取得してキーワードマッチした番組を返す。"""
    date_str = date.strftime("%Y%m%d")
    url = BASE_URL.format(kind=kind)
    ch_map = BS_CH if kind == "bs" else TERRESTRIAL_CH

    params: dict = {"broad_cast_date": date_str}
    if kind == "td":
        params["ggm_group_id"] = GGM_GROUP_ID

    try:
        r = requests.get(
            url,
            params=params,
            headers=HEADERS,
            timeout=20,
        )
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"[bangumi] {kind}/{date_str} fetch error: {e}")
        return []

    soup = BeautifulSoup(r.content.decode("utf-8", errors="replace"), "html.parser")
    programs = soup.select("li[s][e][pid]")

    results = []
    for li in programs:
        title_el = li.select_one("p.program_title")
        detail_el = li.select_one("p.program_detail")
        if not title_el:
            continue

        title = title_el.get_text(strip=True)
        detail = detail_el.get_text(strip=True) if detail_el else ""

        if not _matches_keyword(title, detail):
            continue

        se_id = li.get("se-id", "")
        s = li.get("s", "")
        pid = li.get("pid", "")
        channel = _ch_name(se_id, ch_map)
        broadcast_dt = _parse_datetime(s) if s else None

        results.append({
            "program_name": title,
            "description": detail or None,
            "channel": channel,
            "broadcast_datetime": broadcast_dt,
            "is_replay": any(kw in title + detail for kw in ["再放送", "再配信", "見逃し", "アンコール"]),
            "source_url": f"https://bangumi.org/epg/{kind}?broad_cast_date={date_str}#pid{pid}",
            "source_name": "bangumi",
        })

    return results


def scrape_bangumi(days_ahead: int = 14) -> list[dict]:
    """
    今日から days_ahead 日間の地上波・BS を取得し、
    ゲーム音楽関連番組のリストを返す。
    """
    now = datetime.now(JST).replace(hour=0, minute=0, second=0, microsecond=0)
    kinds = ["td", "bs"]  # 地上波・BS（CSは番組数が膨大なため除外）

    all_results: list[dict] = []
    seen_keys: set[str] = set()

    for kind in kinds:
        for i in range(days_ahead):
            target_date = now + timedelta(days=i)
            found = _fetch_day(kind, target_date)
            for prog in found:
                key = f"{prog['channel']}_{prog['broadcast_datetime']}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    all_results.append(prog)

            if found:
                print(f"[bangumi] {kind}/{target_date.strftime('%Y-%m-%d')}: {len(found)} matches")

            time.sleep(2)  # アクセス間隔（週1回のため余裕あり）

    print(f"[bangumi] total: {len(all_results)} game music programs found")
    return all_results
