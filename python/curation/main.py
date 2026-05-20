"""楽曲キュレーション収集スクリプト（Last.fm版）。

実行例:
  # 接続テスト（1アーティスト検索のみ）
  cd python && .venv/Scripts/python -m curation.main --test-connection

  # 小規模テスト（シード最初の5名、DB書き込みなし）
  cd python && .venv/Scripts/python -m curation.main --dry-run --limit-artists 5 --no-related

  # 本実行（全シード・類似アーティスト拡張・上位100曲を投入）
  cd python && .venv/Scripts/python -m curation.main
"""
import argparse
import logging
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from utils.config import LASTFM_API_KEY
from curation.seed_artists import SEED_ARTISTS
from curation.lastfm_client import (
    search_artist,
    get_artist_info,
    get_similar_artists,
    get_artist_top_tags,
    get_artist_top_tracks,
    get_track_info,
    get_track_top_tags,
)
from curation.filters import filter_artist, filter_track
from curation.live_performance import judge_live_performance
from curation.scoring import score_track
from curation.supabase_writer import build_record, upsert_tracks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

TOP_N          = 100
SIMILAR_DEPTH  = 2
SIMILAR_LIMIT  = 15  # 1アーティストあたりの類似アーティスト取得数


# ---------------------------------------------------------------------------
# Phase 1: アーティスト収集
# ---------------------------------------------------------------------------

def collect_artists(
    api_key: str,
    limit_artists: int | None = None,
    use_related: bool = True,
) -> list[tuple[str, dict | None, bool]]:
    """シードアーティストを解決し、類似アーティストで拡張する。
    Returns: [(artist_name, artist_info_or_none, is_seed), ...]
    """
    seeds = SEED_ARTISTS[:limit_artists] if limit_artists else SEED_ARTISTS
    found: dict[str, tuple[dict | None, bool]] = {}  # name → (info, is_seed)

    logger.info("=== Phase 1: シードアーティスト検索 (%d名) ===", len(seeds))
    for name, _ in seeds:
        info = get_artist_info(api_key, name)
        if info:
            canonical = info.get("name", name)
            found[canonical] = (info, True)
            listeners = info.get("stats", {}).get("listeners", "?")
            logger.info("  ✓ %s (listeners=%s)", canonical, listeners)
        else:
            # getInfo 失敗時は search にフォールバック
            hit = search_artist(api_key, name)
            if hit:
                canonical = hit.get("name", name)
                found[canonical] = (None, True)
                logger.info("  ✓ %s (searchのみ)", canonical)
            else:
                logger.warning("  ✗ 未発見: %s", name)

    logger.info("シード解決: %d / %d", len(found), len(seeds))

    if not use_related:
        return [(n, i, s) for n, (i, s) in found.items()]

    # 類似アーティスト拡張（depth=2）
    logger.info("=== Phase 1b: 類似アーティスト拡張 (depth=%d) ===", SIMILAR_DEPTH)
    frontier = [n for n, (_, is_seed) in found.items() if is_seed]
    for depth in range(SIMILAR_DEPTH):
        next_frontier: list[str] = []
        logger.info("  depth %d: %d アーティストから拡張", depth + 1, len(frontier))
        for artist_name in frontier:
            similar = get_similar_artists(api_key, artist_name, limit=SIMILAR_LIMIT)
            for sa in similar:
                sa_name = sa.get("name", "")
                if sa_name and sa_name not in found:
                    info = get_artist_info(api_key, sa_name)
                    found[sa_name] = (info, False)
                    next_frontier.append(sa_name)
        frontier = next_frontier
        logger.info("  depth %d 完了: 合計 %d アーティスト", depth + 1, len(found))

    return [(n, i, s) for n, (i, s) in found.items()]


# ---------------------------------------------------------------------------
# Phase 2: アーティストフィルタ
# ---------------------------------------------------------------------------

def filter_artists(
    artists: list[tuple[str, dict | None, bool]],
) -> list[tuple[str, dict | None, bool]]:
    passed, dropped = [], 0
    for name, info, is_seed in artists:
        ok, reason = filter_artist(name, info, is_seed)
        if ok:
            passed.append((name, info, is_seed))
        else:
            dropped += 1
            logger.debug("  除外アーティスト: %s — %s", name, reason)

    logger.info("=== Phase 2: アーティストフィルタ: %d通過 / %d除外 ===",
                len(passed), dropped)
    return passed


# ---------------------------------------------------------------------------
# Phase 3-6: 楽曲取得・判定・スコアリング
# ---------------------------------------------------------------------------

def collect_and_score(
    api_key: str,
    artists: list[tuple[str, dict | None, bool]],
) -> list[dict]:
    logger.info("=== Phase 3-6: 楽曲収集・スコアリング (%d アーティスト) ===", len(artists))

    records: list[dict] = []

    for i, (artist_name, artist_info, is_seed) in enumerate(artists, 1):
        # アーティストタグ取得（フィルタ・生演奏判定に使用）
        artist_tags = get_artist_top_tags(api_key, artist_name)

        # アーティスト統計
        stats = (artist_info or {}).get("stats", {})
        try:
            artist_listeners = int(stats.get("listeners", 0) or 0)
            artist_playcount = int(stats.get("playcount", 0) or 0)
        except (ValueError, TypeError):
            artist_listeners = artist_playcount = 0

        artist_url = (artist_info or {}).get("url", "") or ""

        # トップトラック取得
        tracks = get_artist_top_tracks(api_key, artist_name, limit=10)
        if not tracks:
            continue

        passed_count = 0
        for track in tracks:
            track_name = track.get("name", "")
            if not track_name:
                continue

            # duration（Last.fm のトップトラックは duration が含まれないことが多い）
            try:
                duration_sec = int(track.get("duration", 0) or 0)
            except (ValueError, TypeError):
                duration_sec = 0

            # 楽曲フィルタ
            ok, reason = filter_track(track_name, duration_sec, artist_tags, is_seed)
            if not ok:
                logger.debug("  除外: %s / %s — %s", artist_name, track_name, reason)
                continue

            # 楽曲タグ取得
            track_tags = get_track_top_tags(api_key, artist_name, track_name)

            # 生演奏判定
            is_live, confidence = judge_live_performance(track_tags, artist_tags, is_seed)
            if not is_live:
                logger.debug("  非生演奏: %s / %s", artist_name, track_name)
                continue

            # 楽曲再生数（track.getTopTracks の playcount を使用）
            try:
                track_playcount = int(track.get("playcount", 0) or 0)
                track_listeners = int(track.get("listeners", 0) or 0)
            except (ValueError, TypeError):
                track_playcount = track_listeners = 0

            # スコアリング
            scores = score_track(
                track_playcount=track_playcount,
                track_listeners=track_listeners,
                artist_listeners=artist_listeners,
                artist_playcount=artist_playcount,
                is_live=is_live,
                live_confidence=confidence,
            )

            rec = build_record(
                track_name=track_name,
                artist_name=artist_name,
                artist_url=artist_url,
                artist_listeners=artist_listeners,
                spotify_url=None,
                is_live=is_live,
                scores=scores,
            )
            records.append(rec)
            passed_count += 1

        if passed_count > 0:
            logger.info("  [%d/%d] %s: %d曲通過", i, len(artists), artist_name, passed_count)

    logger.info("スコアリング完了: %d曲", len(records))
    records.sort(key=lambda r: r.get("total_score", 0) or 0, reverse=True)
    return records


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Last.fm 楽曲キュレーション収集スクリプト")
    parser.add_argument("--test-connection", action="store_true",
                        help="接続テスト: 1アーティスト検索のみ")
    parser.add_argument("--dry-run", action="store_true",
                        help="Supabase 書き込みをスキップして結果を表示")
    parser.add_argument("--limit-artists", type=int, default=None,
                        help="シードアーティスト上限数（テスト用）")
    parser.add_argument("--no-related", action="store_true",
                        help="類似アーティスト拡張をスキップ")
    parser.add_argument("--top-n", type=int, default=TOP_N,
                        help=f"投入する上位N曲（デフォルト: {TOP_N}）")
    args = parser.parse_args()

    if not LASTFM_API_KEY:
        logger.error("LASTFM_API_KEY が未設定です。python/.env に設定してください。")
        sys.exit(1)

    # --- 接続テスト ---
    if args.test_connection:
        logger.info("=== 接続テスト ===")
        test_name = SEED_ARTISTS[0][0]
        info = get_artist_info(LASTFM_API_KEY, test_name)
        if info:
            listeners = info.get("stats", {}).get("listeners", "?")
            logger.info("✓ 接続成功: %s (listeners=%s)", info.get("name"), listeners)
        else:
            logger.error("✗ アーティスト情報取得失敗")
            sys.exit(1)
        return

    # Phase 1: 収集
    artists = collect_artists(
        LASTFM_API_KEY,
        limit_artists=args.limit_artists,
        use_related=not args.no_related,
    )

    # Phase 2: フィルタ
    artists = filter_artists(artists)
    if not artists:
        logger.error("フィルタ後にアーティストが0名。中止します。")
        sys.exit(1)

    # Phase 3-6: 楽曲収集・スコアリング
    records = collect_and_score(LASTFM_API_KEY, artists)
    if not records:
        logger.error("楽曲が0曲。中止します。")
        sys.exit(1)

    top_records = records[:args.top_n]
    logger.info("=== 投入候補: 上位 %d 曲 ===", len(top_records))
    for i, rec in enumerate(top_records[:15], 1):
        logger.info("  %2d. [%5.1f] %s — %s",
                    i, rec.get("total_score", 0), rec["track_name"], rec["cover_artist"])
    if len(top_records) > 15:
        logger.info("  ... 以下 %d 曲", len(top_records) - 15)

    if args.dry_run:
        logger.info("=== DRY RUN: Supabase 書き込みをスキップ ===")
        return

    # Phase 7: 投入
    logger.info("=== Phase 7: Supabase に投入 ===")
    inserted, updated = upsert_tracks(top_records)
    logger.info("完了: 新規追加=%d, 既存更新=%d", inserted, updated)

    total = inserted + updated
    if total < 30:
        logger.warning("⚠️  投入曲数が30曲未満 (%d曲)。シード追加や類似アーティスト深度の調整を検討してください。", total)
    else:
        logger.info("✓ Sprint 1 完了: %d曲を music_curation に投入しました。", total)


if __name__ == "__main__":
    main()
