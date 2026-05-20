"""5軸スコアリングロジック。

総合スコア = 認知度 × 0.25 + 実力 × 0.30 + エモーション × 0.20 + 配信安定性 × 0.15
           + 生演奏ボーナス（is_live=True なら +10、スケール後）

各スコアは 0〜100 で正規化。
認知度はフェーズ1では Spotify popularity / followers で代替（将来 IGDB API 連携予定）。
"""
import math


# ---------------------------------------------------------------------------
# 正規化ユーティリティ
# ---------------------------------------------------------------------------

def _log_normalize(value: float, max_value: float, scale: float = 100.0) -> float:
    """log スケールで 0〜scale に正規化（フォロワー数等の長尾分布向け）。"""
    if value <= 0:
        return 0.0
    return min(scale, math.log1p(value) / math.log1p(max_value) * scale)


def _linear_normalize(value: float, max_value: float, scale: float = 100.0) -> float:
    if max_value <= 0:
        return 0.0
    return min(scale, max(0.0, value / max_value * scale))


# ---------------------------------------------------------------------------
# 各軸スコア計算
# ---------------------------------------------------------------------------

# Spotify popularity の最大値は 100
_MAX_POPULARITY = 100.0
# followers の基準値（月間アクティブリスナー 1M 相当を上限）
_MAX_FOLLOWERS = 1_000_000.0


def calc_awareness_score(track_popularity: int, artist_popularity: int) -> float:
    """認知度スコア（0〜100）。
    楽曲 popularity × 0.6 + アーティスト popularity × 0.4 で代替。
    将来的に IGDB 連携でゲーム知名度を使う予定。
    """
    t = _linear_normalize(track_popularity, _MAX_POPULARITY)
    a = _linear_normalize(artist_popularity, _MAX_POPULARITY)
    return t * 0.6 + a * 0.4


def calc_skill_score(followers: int, artist_popularity: int) -> float:
    """実力スコア（0〜100）。フォロワー数 × 0.6 + 人気度 × 0.4。"""
    f = _log_normalize(followers, _MAX_FOLLOWERS)
    p = _linear_normalize(artist_popularity, _MAX_POPULARITY)
    return f * 0.6 + p * 0.4


def calc_emotion_score(track_popularity: int, live_confidence: float) -> float:
    """エモーションスコア（0〜100）。楽曲人気度 + 生演奏確信度ボーナス。"""
    base = _linear_normalize(track_popularity, _MAX_POPULARITY)
    bonus = live_confidence * 20.0  # 最大 +20
    return min(100.0, base + bonus)


def calc_stability_score(followers: int) -> float:
    """配信安定性スコア（0〜100）。フォロワー数を代替指標とする。"""
    return _log_normalize(followers, _MAX_FOLLOWERS)


# ---------------------------------------------------------------------------
# 総合スコア
# ---------------------------------------------------------------------------

def calc_total_score(
    awareness: float,
    skill: float,
    emotion: float,
    stability: float,
    is_live: bool,
) -> float:
    """重み付き総合スコア（0〜100）。"""
    raw = (
        awareness  * 0.25
        + skill    * 0.30
        + emotion  * 0.20
        + stability * 0.15
    )
    if is_live:
        raw += 10.0
    return min(100.0, round(raw, 2))


# ---------------------------------------------------------------------------
# エントリーポイント
# ---------------------------------------------------------------------------

def score_track(
    track: dict,
    artist: dict,
    is_live: bool,
    live_confidence: float,
) -> dict:
    """トラックとアーティスト情報からスコア辞書を計算して返す。"""
    track_popularity = track.get("popularity", 0) or 0
    artist_popularity = artist.get("popularity", 0) or 0
    followers = artist.get("followers", {}).get("total", 0) or 0

    awareness = calc_awareness_score(track_popularity, artist_popularity)
    skill = calc_skill_score(followers, artist_popularity)
    emotion = calc_emotion_score(track_popularity, live_confidence)
    stability = calc_stability_score(followers)
    total = calc_total_score(awareness, skill, emotion, stability, is_live)

    return {
        "awareness_score": round(awareness, 2),
        "skill_score":     round(skill, 2),
        "emotion_score":   round(emotion, 2),
        "stability_score": round(stability, 2),
        "total_score":     total,
    }
