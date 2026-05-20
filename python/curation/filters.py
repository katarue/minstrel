"""アーティスト・楽曲のフィルタリングロジック。"""
import re

# フォロワー数の最低ライン（Spotify followers）
MIN_FOLLOWERS = 1_000

# generic アーティスト名パターン（小文字マッチ）
_GENERIC_PATTERNS = re.compile(
    r"\b(relaxing|sleep|study|lofi|lo-fi|meditation|ambient|focus|calm|"
    r"background|beautiful|peaceful|soft|gentle|soothing|nature)\b",
    re.IGNORECASE,
)

# ゲーム音楽・カバーとみなすキーワード（楽曲名・アルバム名）
_GAME_MUSIC_KEYWORDS = re.compile(
    r"\b(final fantasy|zelda|mario|sonic|kirby|pokemon|castlevania|"
    r"chrono trigger|undertale|octopath|nier|persona|fire emblem|"
    r"kingdom hearts|xenogears|xenoblade|tales|atelier|bravely|"
    r"dark souls|sekiro|elden ring|hollow knight|celeste|"
    r"video game|game music|ost|original soundtrack|arrangement|cover|"
    r"nintendo|snes|nes|n64|playstation|ff[0-9]|ffvii|ffxiv|"
    r"ゲーム|アレンジ|カバー)\b",
    re.IGNORECASE,
)

# 楽曲長フィルタ（ms）
MIN_DURATION_MS = 60_000    # 1分
MAX_DURATION_MS = 600_000   # 10分


def is_generic_artist(name: str) -> bool:
    return bool(_GENERIC_PATTERNS.search(name))


def has_enough_followers(artist: dict) -> bool:
    followers = artist.get("followers", {}).get("total", 0) or 0
    return followers >= MIN_FOLLOWERS


def is_game_music_track(track: dict) -> bool:
    """楽曲名・アルバム名にゲーム音楽キーワードが含まれるか。"""
    name = track.get("name", "")
    album_name = track.get("album", {}).get("name", "") if track.get("album") else ""
    return bool(
        _GAME_MUSIC_KEYWORDS.search(name) or
        _GAME_MUSIC_KEYWORDS.search(album_name)
    )


def is_valid_duration(track: dict) -> bool:
    ms = track.get("duration_ms", 0) or 0
    return MIN_DURATION_MS <= ms <= MAX_DURATION_MS


def filter_artist(artist: dict) -> tuple[bool, str]:
    """アーティストをフィルタ。(pass, reason) を返す。"""
    name = artist.get("name", "")
    if is_generic_artist(name):
        return False, f"generic name: {name}"
    if not has_enough_followers(artist):
        followers = artist.get("followers", {}).get("total", 0)
        return False, f"followers too low: {followers}"
    return True, ""


def filter_track(track: dict) -> tuple[bool, str]:
    """楽曲をフィルタ。(pass, reason) を返す。"""
    if not is_valid_duration(track):
        ms = track.get("duration_ms", 0)
        return False, f"duration out of range: {ms}ms"
    if not is_game_music_track(track):
        return False, "not recognized as game music"
    return True, ""
