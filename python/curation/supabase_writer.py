"""music_curation テーブルへの書き込み。

重複チェック: cover_artist_spotify_id + track_name の組み合わせで upsert。
"""
import logging

from utils.db import get_client

logger = logging.getLogger(__name__)


def _build_record(
    track: dict,
    artist: dict,
    scores: dict,
    is_live: bool,
    audio_features: dict | None,
) -> dict:
    """Supabase に投入するレコード辞書を構築する。"""
    artist_id = artist.get("id", "")
    track_name = track.get("name", "")
    album = track.get("album") or {}

    record: dict = {
        "track_name": track_name,
        "cover_artist": artist.get("name", ""),
        "cover_artist_spotify_id": artist_id,
        "artist_monthly_listeners": artist.get("followers", {}).get("total"),
        "spotify_url": (track.get("external_urls") or {}).get("spotify"),
        "is_live_performance": is_live,
        "status": "unchecked",
        # スコア
        "awareness_score": scores.get("awareness_score"),
        "skill_score":     scores.get("skill_score"),
        "emotion_score":   scores.get("emotion_score"),
        "stability_score": scores.get("stability_score"),
        "total_score":     scores.get("total_score"),
    }

    # Audio Features（取得できた場合のみ）
    if audio_features:
        record["acousticness"]     = audio_features.get("acousticness")
        record["instrumentalness"] = audio_features.get("instrumentalness")
        record["energy"]           = audio_features.get("energy")
        record["liveness"]         = audio_features.get("liveness")

    return record


def upsert_tracks(records: list[dict]) -> tuple[int, int]:
    """music_curation テーブルに upsert する。
    Returns: (inserted_count, skipped_count)
    """
    if not records:
        return 0, 0

    db = get_client()
    inserted = 0
    skipped = 0

    for rec in records:
        artist_id = rec.get("cover_artist_spotify_id", "")
        track_name = rec.get("track_name", "")

        # 既存チェック
        existing = (
            db.table("music_curation")
            .select("id")
            .eq("cover_artist_spotify_id", artist_id)
            .eq("track_name", track_name)
            .execute()
        )
        if existing.data:
            # 既存レコードはスコアのみ更新（status は変えない）
            rec_id = existing.data[0]["id"]
            update_fields = {k: v for k, v in rec.items()
                             if k not in ("status", "cover_artist_spotify_id", "track_name")}
            db.table("music_curation").update(update_fields).eq("id", rec_id).execute()
            skipped += 1
        else:
            db.table("music_curation").insert(rec).execute()
            inserted += 1

    logger.info("[writer] upsert complete: inserted=%d, updated_existing=%d", inserted, skipped)
    return inserted, skipped
