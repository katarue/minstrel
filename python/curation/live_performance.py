"""生演奏判定ロジック（タグベース、Last.fm版）。

方針: 緩め判定。取りこぼしを減らし母数を確保。最終判断はユーザーの試聴。
電子ピアノは生演奏に含める。チップチューンのみ除外。
シードアーティストはチップチューン系タグが付いていない限り無条件で候補に残す。
"""

# 加点タグ（このいずれかがあれば生演奏候補）
LIVE_TAGS = {
    "piano", "acoustic", "instrumental", "orchestral", "orchestra",
    "strings", "guitar", "violin", "cello", "jazz", "classical",
    "cover", "live", "piano cover", "arrangement", "acoustic guitar",
    "fingerpicking", "fingerstyle", "solo piano", "harp", "flute",
    "chamber music", "string quartet", "baroque", "new age",
    "pianist",        # ピアニスト（PurpleSchala等）
    "piano music",    # ピアノ音楽
    "ambient",        # ambient piano は生演奏に含める
}

# チップチューン系タグ（シードアーティスト除外の唯一の基準）
CHIPTUNE_TAGS = {
    "chiptune", "8bit", "8-bit", "16bit", "16-bit",
    "chip music", "game boy", "famicom",
}

# 非シードアーティストへの減点タグ（電子系を含む）
NON_LIVE_TAGS = CHIPTUNE_TAGS | {
    "electronic", "edm", "synth", "lo-fi", "lofi",
    "vaporwave", "synthwave",
}


def judge_live_performance(
    track_tags: list[str],
    artist_tags: list[str],
    is_seed_artist: bool = False,
) -> tuple[bool, float]:
    """タグベースで生演奏を判定し (is_live, confidence) を返す。

    シードアーティストはチップチューン系タグのみで除外。
    非シードは加点タグ1つでも生演奏候補、減点タグのみで除外。
    """
    all_tags = set(track_tags) | set(artist_tags)

    has_live_tag     = bool(all_tags & LIVE_TAGS)
    has_chiptune_tag = bool(all_tags & CHIPTUNE_TAGS)
    has_non_live_tag = bool(all_tags & NON_LIVE_TAGS)

    # シードアーティストはチップチューン系タグが付いていない限り無条件で残す
    if is_seed_artist:
        if has_chiptune_tag and not has_live_tag:
            return False, 0.2
        confidence = 0.8 if has_live_tag else 0.6
        return True, confidence

    # 非シード: 加点タグあり → 生演奏候補
    if has_live_tag:
        confidence = 0.7 if not has_non_live_tag else 0.5
        return True, confidence

    # 非シード: 加点タグなし・減点タグのみ → 除外
    if has_non_live_tag:
        return False, 0.1

    # タグ情報なし → 候補として残す（緩め）
    return True, 0.4
