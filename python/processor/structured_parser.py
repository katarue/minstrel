"""
チケットサイト向け構造化パーサーのユーティリティ関数群。
scraper_teket.py 等から使用する。Claude extraction の代替として構造化済みデータを変換する。
"""
from __future__ import annotations

import re
from datetime import datetime, timezone, timedelta

JST = timezone(timedelta(hours=9))

# ── 地域名 → 都道府県 変換テーブル ──────────────────────────────────────
_REGION_MAP: dict[str, str] = {
    # 都道府県名（「都・道・府・県」なし）
    "北海道": "北海道", "札幌": "北海道",
    "青森": "青森県", "岩手": "岩手県",
    "宮城": "宮城県", "仙台": "宮城県",
    "秋田": "秋田県", "山形": "山形県", "福島": "福島県",
    "茨城": "茨城県", "栃木": "栃木県", "群馬": "群馬県",
    "埼玉": "埼玉県", "千葉": "千葉県",
    "東京": "東京都", "東京都": "東京都",
    "神奈川": "神奈川県", "横浜": "神奈川県",
    "新潟": "新潟県", "富山": "富山県", "石川": "石川県", "福井": "福井県",
    "山梨": "山梨県", "長野": "長野県", "岐阜": "岐阜県",
    "静岡": "静岡県", "愛知": "愛知県", "名古屋": "愛知県", "三重": "三重県",
    "滋賀": "滋賀県", "京都": "京都府", "京都府": "京都府",
    "大阪": "大阪府", "大阪府": "大阪府",
    "兵庫": "兵庫県", "神戸": "兵庫県",
    "奈良": "奈良県", "和歌山": "和歌山県",
    "鳥取": "鳥取県", "島根": "島根県", "岡山": "岡山県",
    "広島": "広島県", "山口": "山口県",
    "徳島": "徳島県", "香川": "香川県", "愛媛": "愛媛県", "高知": "高知県",
    "福岡": "福岡県", "佐賀": "佐賀県", "長崎": "長崎県", "熊本": "熊本県",
    "大分": "大分県", "宮崎": "宮崎県", "鹿児島": "鹿児島県",
    "沖縄": "沖縄県", "那覇": "沖縄県",
}

# teket の region に出現する広域名（都道府県に特定できないのでスキップ）
_REGION_SKIP = frozenset({
    "関東", "近畿", "関西", "東海", "中部", "北陸", "中国地方",
    "四国", "九州", "東北", "甲信越", "北関東",
})


def region_to_prefecture(region: str, venue: str = "") -> str | None:
    """teket の region / venue 文字列から都道府県名を返す。特定できない場合は None。"""
    region = (region or "").strip()
    if region in _REGION_SKIP:
        return _pref_from_text(venue)
    if region in _REGION_MAP:
        return _REGION_MAP[region]
    for key, pref in _REGION_MAP.items():
        if key in region:
            return pref
    return _pref_from_text(venue)


def _pref_from_text(text: str) -> str | None:
    if not text:
        return None
    for key, pref in _REGION_MAP.items():
        if key in text:
            return pref
    return None


# ── ISO 8601 変換 ─────────────────────────────────────────────────────────
def build_iso8601(date_str: str, time_str: str = "") -> str | None:
    """
    "2025-06-15" + "14:00" → "2025-06-15T14:00:00+09:00"
    パース失敗時は None を返す。
    """
    if not date_str:
        return None
    try:
        date_str = date_str.strip()
        time_str = (time_str or "").strip()
        if time_str:
            dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        else:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.replace(tzinfo=JST).isoformat()
    except ValueError:
        return None


# ── ゲームタイトル キーワードマッチ ─────────────────────────────────────
# (正式名称, マッチキーワードのリスト)  ※取りこぼしより誤検知を排除する設計
_GAME_PATTERNS: list[tuple[str, list[str]]] = [
    ("ファイナルファンタジー", ["ファイナルファンタジー", "FINAL FANTASY", "Final Fantasy"]),
    ("ドラゴンクエスト", ["ドラゴンクエスト", "Dragon Quest", "ドラクエ"]),
    ("ゼルダの伝説", ["ゼルダの伝説", "ゼルダ", "Zelda"]),
    ("ポケットモンスター", ["ポケットモンスター", "ポケモン", "Pokémon", "Pokemon"]),
    ("スーパーマリオ", ["スーパーマリオ", "Super Mario"]),
    ("星のカービィ", ["星のカービィ", "カービィ", "Kirby"]),
    ("メトロイド", ["メトロイド", "Metroid"]),
    ("モンスターハンター", ["モンスターハンター", "Monster Hunter", "モンハン"]),
    ("テイルズ オブ", ["テイルズ オブ", "Tales of"]),
    ("バイオハザード", ["バイオハザード", "Resident Evil"]),
    ("ロックマン", ["ロックマン", "Mega Man"]),
    ("大乱闘スマッシュブラザーズ", ["スマッシュブラザーズ", "スマブラ", "Smash Bros"]),
    ("どうぶつの森", ["どうぶつの森", "Animal Crossing"]),
    ("スプラトゥーン", ["スプラトゥーン", "Splatoon"]),
    ("MOTHER", ["MOTHER2", "MOTHER3", "マザー2", "マザー3"]),
    ("ペルソナ", ["ペルソナ", "Persona"]),
    ("真・女神転生", ["女神転生", "メガテン", "Megami Tensei"]),
    ("英雄伝説（軌跡シリーズ）", ["軌跡シリーズ", "英雄伝説"]),
    ("ロマンシング サガ", ["ロマンシング サガ", "ロマサガ", "SaGa"]),
    ("聖剣伝説", ["聖剣伝説"]),
    ("グランブルーファンタジー", ["グランブルーファンタジー", "グラブル"]),
    ("プリンセスコネクト！Re:Dive", ["プリンセスコネクト", "プリコネ"]),
    ("原神", ["原神", "Genshin Impact"]),
    ("崩壊：スターレイル", ["崩壊スターレイル", "スターレイル"]),
    ("逆転裁判", ["逆転裁判", "Ace Attorney"]),
    ("大神", ["大神", "Ōkami"]),
    ("クロノ・トリガー", ["クロノトリガー", "クロノ・トリガー", "Chrono Trigger"]),
    ("キングダム ハーツ", ["キングダムハーツ", "Kingdom Hearts"]),
    ("NieR", ["NieR", "ニーア", "ドラッグ オン ドラグーン"]),
    ("UNDERTALE", ["UNDERTALE", "アンダーテール"]),
    ("ストリートファイター", ["ストリートファイター", "Street Fighter"]),
    ("鉄拳", ["TEKKEN", "鉄拳"]),
    ("スターオーシャン", ["スターオーシャン", "Star Ocean"]),
    ("ウマ娘 プリティーダービー", ["ウマ娘"]),
]


def extract_prefecture(text: str) -> str | None:
    """テキストから都道府県名を抽出する（公開ラッパー）。"""
    return _pref_from_text(text)


def extract_date_time(text: str) -> tuple[str | None, str | None]:
    """日本語テキストから日付・開演時刻を抽出する。
    Returns: (YYYY-MM-DD or None, HH:MM or None)
    """
    date_str = None
    time_str = None

    m = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', text)
    if m:
        date_str = f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"

    # 「開演」を優先、なければ「開場」
    m = re.search(r'開演[：:\s]*(\d{1,2}):(\d{2})', text)
    if not m:
        m = re.search(r'(?:START|スタート)[：:\s]*(\d{1,2}):(\d{2})', text, re.I)
    if not m:
        m = re.search(r'開場[：:\s]*(\d{1,2}):(\d{2})', text)
    if m:
        time_str = f"{m.group(1).zfill(2)}:{m.group(2)}"

    return date_str, time_str


def game_titles_from_text(text: str) -> list[str]:
    """テキストからゲームフランチャイズ名を抽出する（キーワードマッチ）。
    取りこぼしより誤検知を排除する設計のため、短い汎用単語は登録しない。
    """
    if not text:
        return []
    found: list[str] = []
    for canonical_name, keywords in _GAME_PATTERNS:
        for kw in keywords:
            if kw in text:
                found.append(canonical_name)
                break  # 同フランチャイズの重複追加を防ぐ
    return found
