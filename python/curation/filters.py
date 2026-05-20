"""アーティスト・楽曲のフィルタリングロジック（Last.fm版）。"""
import re

# アーティストのリスナー数最低ライン（Last.fm listeners）
MIN_LISTENERS = 500  # 緩めに設定

# generic アーティスト名パターン（小文字マッチ）
_GENERIC_PATTERNS = re.compile(
    r"\b(relaxing|sleep|study|lofi|lo-fi|meditation|ambient|focus|calm|"
    r"background|beautiful|peaceful|soft|gentle|soothing|nature)\b",
    re.IGNORECASE,
)

# ゲーム音楽・カバーとみなすキーワード（楽曲名）
_GAME_MUSIC_KEYWORDS = re.compile(
    r"\b(final fantasy|zelda|mario|sonic|kirby|pokemon|castlevania|"
    r"chrono trigger|undertale|octopath|nier|persona|fire emblem|"
    r"kingdom hearts|xenogears|xenoblade|tales|atelier|bravely|"
    r"dark souls|sekiro|elden ring|hollow knight|celeste|"
    r"video game|game music|vgm|ost|original soundtrack|arrangement|cover|"
    r"nintendo|snes|nes|n64|ff[0-9]|ffvii|ffxiv|"
    r"ゲーム|アレンジ|カバー)\b",
    re.IGNORECASE,
)

# 楽曲長フィルタ（秒）
MIN_DURATION_SEC = 60    # 1分
MAX_DURATION_SEC = 600   # 10分


def is_generic_artist(name: str) -> bool:
    return bool(_GENERIC_PATTERNS.search(name))


def has_enough_listeners(artist_info: dict) -> bool:
    """Last.fm の artist.getInfo レスポンスからリスナー数を取得して判定。"""
    try:
        listeners = int(artist_info.get("stats", {}).get("listeners", 0) or 0)
        return listeners >= MIN_LISTENERS
    except (ValueError, TypeError):
        return True  # 取得失敗時は通過させる


def is_game_music_track(track_name: str, artist_tags: list[str]) -> bool:
    """楽曲名にゲーム音楽キーワードが含まれるか、またはタグにvgm/game関連があるか。"""
    if _GAME_MUSIC_KEYWORDS.search(track_name):
        return True
    game_tags = {"video game music", "vgm", "game music", "video games",
                 "nintendo", "final fantasy", "zelda", "pokemon"}
    return bool(game_tags & set(artist_tags))


def is_valid_duration(duration_sec: int) -> bool:
    if duration_sec == 0:
        return True  # 不明な場合は通過
    return MIN_DURATION_SEC <= duration_sec <= MAX_DURATION_SEC


def filter_artist(name: str, artist_info: dict | None, is_seed: bool) -> tuple[bool, str]:
    """アーティストをフィルタ。(pass, reason) を返す。"""
    if is_generic_artist(name):
        return False, f"generic name: {name}"
    if artist_info and not has_enough_listeners(artist_info):
        listeners = artist_info.get("stats", {}).get("listeners", "?")
        return False, f"listeners too low: {listeners}"
    return True, ""


def filter_track(
    track_name: str,
    duration_sec: int,
    artist_tags: list[str],
    is_seed_artist: bool,
) -> tuple[bool, str]:
    """楽曲をフィルタ。(pass, reason) を返す。"""
    if not is_valid_duration(duration_sec):
        return False, f"duration out of range: {duration_sec}s"
    # シードアーティスト由来はゲーム音楽チェックを免除
    if not is_seed_artist and not is_game_music_track(track_name, artist_tags):
        return False, "not recognized as game music"
    return True, ""
