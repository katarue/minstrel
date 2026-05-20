"""生演奏判定ロジック。

判定精度目標: 9割。完璧でなくてよい。
電子ピアノは「生演奏に含める」方針。チップチューンは除外。
"""
import re

# acousticness 閾値（0〜1）— 0.3 以上を生演奏候補とする（緩め）
ACOUSTICNESS_THRESHOLD = 0.3

# 加点キーワード（楽曲名・アルバム名）
_LIVE_KEYWORDS = re.compile(
    r"\b(piano|orchestra|symphonic|acoustic|live|strings|guitar|jazz|"
    r"violin|cello|quartet|trio|duo|harp|flute|brass|ensemble|"
    r"ピアノ|オーケストラ|弦楽|ヴァイオリン|チェロ|アコースティック)\b",
    re.IGNORECASE,
)

# 減点キーワード（チップチューン・電子音楽は除外）
_NON_LIVE_KEYWORDS = re.compile(
    r"\b(chiptune|8.bit|16.bit|synth|electronic|edm|remix|lo.fi|lofi|"
    r"chip|8bit|16bit|vgm chip|chiptune)\b",
    re.IGNORECASE,
)


def judge_live_performance(
    track: dict,
    audio_features: dict | None,
    is_seed_artist: bool = False,
) -> tuple[bool, float]:
    """生演奏かどうかを判定し、(is_live, confidence_0_to_1) を返す。

    confidence は scoring.py でエモーションスコアに反映される。
    """
    name = track.get("name", "")
    album_name = track.get("album", {}).get("name", "") if track.get("album") else ""
    combined = f"{name} {album_name}"

    score = 0.0

    # Audio Features による判定（最も信頼性が高い）
    if audio_features is not None:
        acousticness = audio_features.get("acousticness", 0) or 0
        instrumentalness = audio_features.get("instrumentalness", 0) or 0
        if acousticness >= ACOUSTICNESS_THRESHOLD:
            score += 0.4
        if instrumentalness >= 0.5:
            score += 0.2  # インスト寄り → 生演奏の可能性UP

    # キーワード判定
    if _LIVE_KEYWORDS.search(combined):
        score += 0.3
    if _NON_LIVE_KEYWORDS.search(combined):
        score -= 0.5  # チップチューン・電子音は強く減点

    # シードアーティスト由来は優先
    if is_seed_artist:
        score += 0.2

    # Audio Features が取れなかった場合はキーワードのみ（閾値を低めに）
    if audio_features is None:
        # キーワードがあれば生演奏とみなす
        is_live = _LIVE_KEYWORDS.search(combined) is not None and not _NON_LIVE_KEYWORDS.search(combined)
        confidence = 0.5 if is_live else 0.3
        if is_seed_artist:
            confidence = min(confidence + 0.2, 1.0)
        return is_live, confidence

    confidence = max(0.0, min(1.0, score))
    is_live = confidence >= 0.4

    return is_live, confidence
