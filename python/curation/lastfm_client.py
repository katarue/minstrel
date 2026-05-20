"""Last.fm API ラッパー（APIキーのみ、読み取り専用）。

エンドポイント: https://ws.audioscrobbler.com/2.0/
レート制限: 公式には明記なし。安全のため 0.3秒/リクエストで制限する。
"""
import logging
import time
from typing import Any

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://ws.audioscrobbler.com/2.0/"
RATE_LIMIT_SLEEP = 0.3  # 秒


def _call(api_key: str, method: str, **params) -> dict | None:
    """Last.fm API を呼び出して JSON を返す。失敗時は None。"""
    payload = {
        "method": method,
        "api_key": api_key,
        "format": "json",
        **params,
    }
    try:
        resp = requests.get(BASE_URL, params=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            logger.warning("[lastfm] API error (method=%s): code=%s msg=%s",
                           method, data["error"], data.get("message", ""))
            return None
        return data
    except Exception as e:
        logger.error("[lastfm] request error (method=%s): %s", method, e)
        return None
    finally:
        time.sleep(RATE_LIMIT_SLEEP)


# ---------------------------------------------------------------------------
# アーティスト
# ---------------------------------------------------------------------------

def search_artist(api_key: str, name: str) -> dict | None:
    """アーティスト名で検索し、最初のヒットを返す。
    返値: {"name": str, "listeners": int, "mbid": str, "url": str} | None
    """
    data = _call(api_key, "artist.search", artist=name, limit=5)
    if not data:
        return None
    items = (data.get("results", {})
               .get("artistmatches", {})
               .get("artist", []))
    if not items:
        logger.warning("[lastfm] アーティスト未発見: %s", name)
        return None
    # 名前完全一致を優先
    for item in items:
        if item.get("name", "").lower() == name.lower():
            return item
    return items[0]


def get_artist_info(api_key: str, name: str) -> dict | None:
    """アーティスト情報（リスナー数・再生数・タグ）を取得。"""
    data = _call(api_key, "artist.getInfo", artist=name, autocorrect=1)
    if not data:
        return None
    return data.get("artist")


def get_similar_artists(api_key: str, name: str, limit: int = 20) -> list[dict]:
    """類似アーティストを取得（Spotify Related Artists 相当）。"""
    data = _call(api_key, "artist.getSimilar", artist=name,
                 autocorrect=1, limit=limit)
    if not data:
        return []
    return data.get("similarartists", {}).get("artist", [])


def get_artist_top_tags(api_key: str, name: str) -> list[str]:
    """アーティストのタグリスト（小文字）を返す。"""
    data = _call(api_key, "artist.getTopTags", artist=name, autocorrect=1)
    if not data:
        return []
    tags = data.get("toptags", {}).get("tag", [])
    return [t["name"].lower() for t in tags if isinstance(t, dict)]


# ---------------------------------------------------------------------------
# トラック
# ---------------------------------------------------------------------------

def get_artist_top_tracks(api_key: str, name: str, limit: int = 10) -> list[dict]:
    """アーティストの人気楽曲リストを返す。
    各アイテムに name, playcount, listeners, url が含まれる。
    """
    data = _call(api_key, "artist.getTopTracks", artist=name,
                 autocorrect=1, limit=limit)
    if not data:
        return []
    return data.get("toptracks", {}).get("track", [])


def get_track_info(api_key: str, artist: str, track: str) -> dict | None:
    """楽曲詳細（playcount, listeners, tags, duration）を取得。"""
    data = _call(api_key, "track.getInfo", artist=artist, track=track, autocorrect=1)
    if not data:
        return None
    return data.get("track")


def get_track_top_tags(api_key: str, artist: str, track: str) -> list[str]:
    """楽曲のタグリスト（小文字）を返す。"""
    data = _call(api_key, "track.getTopTags", artist=artist, track=track, autocorrect=1)
    if not data:
        return []
    tags = data.get("toptags", {}).get("tag", [])
    return [t["name"].lower() for t in tags if isinstance(t, dict)]
