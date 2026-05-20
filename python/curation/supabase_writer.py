"""music_curation テーブルへの書き込み（Last.fm版）。

重複チェック: cover_artist + track_name の組み合わせで upsert。
Audio Features カラム（acousticness等）は Last.fm では取得不可なので NULL のまま。
cover_artist_spotify_id には Last.fm の artist.url を格納する（識別子として流用）。
"""
import logging

from utils.db import get_client

logger = logging.getLogger(__name__)


def build_record(
    track_name: str,
    artist_name: str,
    artist_url: str,
    artist_listeners: int,
    spotify_url: str | None,
    is_live: bool,
    scores: dict,
) -> dict:
    return {
        "track_name":               track_name,
        "cover_artist":             artist_name,
        "cover_artist_spotify_id":  artist_url or None,  # Last.fm URL を識別子として流用
        "artist_monthly_listeners": artist_listeners or None,
        "spotify_url":              spotify_url,
        "is_live_performance":      is_live,
        "status":                   "unchecked",
        "awareness_score":          scores.get("awareness_score"),
        "skill_score":              scores.get("skill_score"),
        "emotion_score":            scores.get("emotion_score"),
        "stability_score":          scores.get("stability_score"),
        "total_score":              scores.get("total_score"),
        # acousticness / instrumentalness / energy / liveness は NULL のまま
    }


def upsert_tracks(records: list[dict]) -> tuple[int, int]:
    """music_curation テーブルに upsert する。
    Returns: (inserted_count, updated_count)
    """
    if not records:
        return 0, 0

    db = get_client()
    inserted = 0
    updated = 0

    for rec in records:
        artist = rec.get("cover_artist", "")
        track  = rec.get("track_name", "")

        existing = (
            db.table("music_curation")
            .select("id")
            .eq("cover_artist", artist)
            .eq("track_name", track)
            .execute()
        )

        if existing.data:
            rec_id = existing.data[0]["id"]
            update_fields = {k: v for k, v in rec.items()
                             if k not in ("status", "cover_artist", "track_name")}
            db.table("music_curation").update(update_fields).eq("id", rec_id).execute()
            updated += 1
        else:
            db.table("music_curation").insert(rec).execute()
            inserted += 1

    logger.info("[writer] upsert complete: inserted=%d, updated_existing=%d", inserted, updated)
    return inserted, updated
