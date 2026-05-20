"""生演奏判定ロジック（タグベース、Last.fm版）。

方針: 緩め判定。取りこぼしを減らし母数を確保。最終判断はユーザーの試聴。
電子ピアノは生演奏に含める。チップチューンのみ除外。
"""

# 加点タグ（このいずれかがあれば生演奏候補）
LIVE_TAGS = {
    "piano", "acoustic", "instrumental", "orchestral", "orchestra",
    "strings", "guitar", "violin", "cello", "jazz", "classical",
    "cover", "live", "piano cover", "arrangement", "acoustic guitar",
    "fingerpicking", "fingerstyle", "solo piano", "harp", "flute",
    "chamber music", "string quartet", "baroque", "new age",
}

# 減点タグ（これのみで加点タグが皆無の場合に除外）
NON_LIVE_TAGS = {
    "chiptune", "8bit", "8-bit", "16bit", "16-bit", "electronic",
    "edm", "synth", "lo-fi", "lofi", "vaporwave", "synthwave",
    "chip music", "game boy", "famicom",
}


def judge_live_performance(
    track_tags: list[str],
    artist_tags: list[str],
    is_seed_artist: bool = False,
) -> tuple[bool, float]:
    """タグベースで生演奏を判定し (is_live, confidence) を返す。

    緩め判定: 加点タグが1つでもあれば is_live=True。
    加点タグ皆無かつ減点タグのみの場合のみ除外。
    シードアーティスト由来は常に is_live=True（候補として残す）。
    """
    all_tags = set(track_tags) | set(artist_tags)

    has_live_tag = bool(all_tags & LIVE_TAGS)
    has_non_live_tag = bool(all_tags & NON_LIVE_TAGS)

    # シードアーティスト由来は無条件で残す
    if is_seed_artist:
        if has_non_live_tag and not has_live_tag:
            return False, 0.2  # チップチューンのみは除外
        return True, 0.8 if has_live_tag else 0.6

    # 加点タグあり → 生演奏候補
    if has_live_tag:
        confidence = 0.7 if not has_non_live_tag else 0.5
        return True, confidence

    # 加点タグなし・減点タグのみ → 除外
    if has_non_live_tag:
        return False, 0.1

    # タグ情報なし → 候補として残す（緩め）
    return True, 0.4
