"""Spotify Web API ラッパー（Client Credentials Flow）。

Audio Features と Related Artists は 2025 時点で非推奨だが利用可能。
取得失敗時はそれぞれ None / [] を返す（フォールバック済み）。
"""
import logging
import time
from typing import Any

import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

logger = logging.getLogger(__name__)


def build_client(client_id: str, client_secret: str) -> spotipy.Spotify:
    auth = SpotifyClientCredentials(
        client_id=client_id,
        client_secret=client_secret,
    )
    return spotipy.Spotify(auth_manager=auth, requests_timeout=10, retries=3)


# ---------------------------------------------------------------------------
# アーティスト
# ---------------------------------------------------------------------------

def search_artist(sp: spotipy.Spotify, name: str, hint: str = "") -> dict | None:
    """アーティスト名で検索して最初のヒットを返す。"""
    query = f"artist:{name}"
    if hint:
        query += f" {hint}"
    try:
        result = sp.search(q=query, type="artist", limit=5)
        items = result.get("artists", {}).get("items", [])
        if not items:
            # genre ヒントなしで再試行
            result = sp.search(q=f"artist:{name}", type="artist", limit=5)
            items = result.get("artists", {}).get("items", [])
        if not items:
            logger.warning("[spotify] アーティスト未発見: %s", name)
            return None
        # 名前が完全一致するものを優先
        for item in items:
            if item["name"].lower() == name.lower():
                return item
        return items[0]
    except Exception as e:
        logger.error("[spotify] search_artist error (%s): %s", name, e)
        return None


def get_artist(sp: spotipy.Spotify, artist_id: str) -> dict | None:
    try:
        return sp.artist(artist_id)
    except Exception as e:
        logger.error("[spotify] get_artist error (%s): %s", artist_id, e)
        return None


def get_related_artists(sp: spotipy.Spotify, artist_id: str) -> list[dict]:
    """関連アーティストを取得（deprecated だがまだ利用可能）。失敗時は []。"""
    try:
        result = sp.artist_related_artists(artist_id)
        return result.get("artists", [])
    except Exception as e:
        logger.warning("[spotify] get_related_artists failed (%s): %s — skipping", artist_id, e)
        return []


# ---------------------------------------------------------------------------
# トラック
# ---------------------------------------------------------------------------

def get_artist_top_tracks(sp: spotipy.Spotify, artist_id: str, market: str = "JP") -> list[dict]:
    """アーティストの人気楽曲を取得（最大10曲）。"""
    try:
        result = sp.artist_top_tracks(artist_id, country=market)
        return result.get("tracks", [])
    except Exception as e:
        logger.error("[spotify] get_artist_top_tracks error (%s): %s", artist_id, e)
        return []


def get_audio_features_bulk(sp: spotipy.Spotify, track_ids: list[str]) -> dict[str, dict | None]:
    """複数トラックの Audio Features を一括取得。返値は {track_id: features_or_none}。
    deprecated だがまだ利用可能。取得失敗時はすべて None を返す。
    """
    result: dict[str, dict | None] = {tid: None for tid in track_ids}
    if not track_ids:
        return result
    # API は一度に最大 100 件
    for i in range(0, len(track_ids), 100):
        chunk = track_ids[i : i + 100]
        try:
            features = sp.audio_features(chunk)
            for feat in (features or []):
                if feat:
                    result[feat["id"]] = feat
        except Exception as e:
            logger.warning("[spotify] get_audio_features_bulk failed: %s — using None", e)
        time.sleep(0.1)
    return result
