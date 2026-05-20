"""5軸スコアリングロジック（Last.fm版）。

総合スコア = 認知度 × 0.25 + 実力 × 0.30 + エモーション × 0.20 + 配信安定性 × 0.15
           + 生演奏ボーナス（is_live=True なら +10）

各スコアは 0〜100 で正規化。
認知度はフェーズ1では楽曲 playcount で代替（将来 IGDB API 連携予定）。
"""
import math


# ---------------------------------------------------------------------------
# 正規化ユーティリティ
# ---------------------------------------------------------------------------

def _log_normalize(value: float, max_value: float, scale: float = 100.0) -> float:
    """log スケールで 0〜scale に正規化（long-tail 分布向け）。"""
    if value <= 0:
        return 0.0
    return min(scale, math.log1p(value) / math.log1p(max_value) * scale)


# Last.fm playcount / listeners の基準上限値
_MAX_TRACK_PLAYCOUNT   = 10_000_000   # 1千万再生
_MAX_ARTIST_LISTENERS  = 1_000_000    # 月間リスナー 100万
_MAX_ARTIST_PLAYCOUNT  = 50_000_000   # 5千万再生


# ---------------------------------------------------------------------------
# 各軸スコア
# ---------------------------------------------------------------------------

def calc_awareness_score(track_playcount: int) -> float:
    """認知度スコア（0〜100）。楽曲 playcount で代替。"""
    return _log_normalize(track_playcount, _MAX_TRACK_PLAYCOUNT)


def calc_skill_score(artist_listeners: int, artist_playcount: int) -> float:
    """実力スコア（0〜100）。アーティストのリスナー数・再生数で評価。"""
    l_score = _log_normalize(artist_listeners, _MAX_ARTIST_LISTENERS)
    p_score = _log_normalize(artist_playcount, _MAX_ARTIST_PLAYCOUNT)
    return l_score * 0.6 + p_score * 0.4


def calc_emotion_score(track_playcount: int, track_listeners: int, live_confidence: float) -> float:
    """エモーションスコア（0〜100）。楽曲再生数 + 生演奏確信度ボーナス。"""
    base_p = _log_normalize(track_playcount, _MAX_TRACK_PLAYCOUNT)
    base_l = _log_normalize(track_listeners, _MAX_ARTIST_LISTENERS)
    base = base_p * 0.6 + base_l * 0.4
    bonus = live_confidence * 20.0
    return min(100.0, base + bonus)


def calc_stability_score(artist_listeners: int) -> float:
    """配信安定性スコア（0〜100）。アーティストのリスナー数で代替。"""
    return _log_normalize(artist_listeners, _MAX_ARTIST_LISTENERS)


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
    track_playcount: int,
    track_listeners: int,
    artist_listeners: int,
    artist_playcount: int,
    is_live: bool,
    live_confidence: float,
) -> dict:
    awareness  = calc_awareness_score(track_playcount)
    skill      = calc_skill_score(artist_listeners, artist_playcount)
    emotion    = calc_emotion_score(track_playcount, track_listeners, live_confidence)
    stability  = calc_stability_score(artist_listeners)
    total      = calc_total_score(awareness, skill, emotion, stability, is_live)

    return {
        "awareness_score":  round(awareness, 2),
        "skill_score":      round(skill, 2),
        "emotion_score":    round(emotion, 2),
        "stability_score":  round(stability, 2),
        "total_score":      total,
    }
