"""楽曲キュレーション収集スクリプト。

実行例:
  # 接続テスト（1アーティスト検索のみ）
  cd python && .venv/Scripts/python -m curation.main --test-connection

  # 小規模テスト（シードアーティスト最初の5名のみ）
  cd python && .venv/Scripts/python -m curation.main --dry-run --limit-artists 5

  # 本実行（全シードアーティスト、Supabase に投入）
  cd python && .venv/Scripts/python -m curation.main

  # 関連アーティスト拡張を無効化して実行
  cd python && .venv/Scripts/python -m curation.main --no-related
"""
import argparse
import logging
import os
import sys
import time

# python/ ディレクトリを sys.path に追加
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from utils.config import SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
from curation.seed_artists import SEED_ARTISTS
from curation.spotify_client import (
    build_client,
    search_artist,
    get_related_artists,
    get_artist_top_tracks,
    get_audio_features_bulk,
)
from curation.filters import filter_artist, filter_track
from curation.live_performance import judge_live_performance
from curation.scoring import score_track
from curation.supabase_writer import upsert_tracks, _build_record

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

TOP_N = 100                 # 最終的に投入する上位N曲
RELATED_DEPTH = 2           # 関連アーティスト拡張の深度
RATE_LIMIT_SLEEP = 0.3      # APIコール間のスリープ（秒）


# ---------------------------------------------------------------------------
# フェーズ1: アーティスト収集
# ---------------------------------------------------------------------------

def collect_artists(
    sp,
    limit_artists: int | None = None,
    use_related: bool = True,
) -> list[tuple[dict, bool]]:
    """シードアーティストを検索し、関連アーティストで拡張する。
    Returns: [(artist_dict, is_seed), ...]
    """
    seeds = SEED_ARTISTS[:limit_artists] if limit_artists else SEED_ARTISTS
    found: dict[str, tuple[dict, bool]] = {}  # id → (artist, is_seed)

    logger.info("=== Phase 1: シードアーティスト検索 (%d名) ===", len(seeds))
    for name, hint in seeds:
        artist = search_artist(sp, name, hint)
        if artist:
            found[artist["id"]] = (artist, True)
            logger.info("  ✓ %s (id=%s, followers=%s, popularity=%d)",
                        artist["name"], artist["id"],
                        artist.get("followers", {}).get("total", "?"),
                        artist.get("popularity", 0))
        else:
            logger.warning("  ✗ 未発見: %s", name)
        time.sleep(RATE_LIMIT_SLEEP)

    logger.info("シード解決: %d / %d", len(found), len(seeds))

    if not use_related:
        return list(found.values())

    # 関連アーティスト拡張（深度2）
    logger.info("=== Phase 1b: 関連アーティスト拡張 (depth=%d) ===", RELATED_DEPTH)
    frontier = list(found.keys())
    for depth in range(RELATED_DEPTH):
        next_frontier = []
        logger.info("  depth %d: %d アーティストから拡張", depth + 1, len(frontier))
        for artist_id in frontier:
            related = get_related_artists(sp, artist_id)
            for ra in related:
                if ra["id"] not in found:
                    found[ra["id"]] = (ra, False)
                    next_frontier.append(ra["id"])
            time.sleep(RATE_LIMIT_SLEEP)
        frontier = next_frontier
        logger.info("  depth %d 完了: 合計 %d アーティスト", depth + 1, len(found))

    return list(found.values())


# ---------------------------------------------------------------------------
# フェーズ2: フィルタリング
# ---------------------------------------------------------------------------

def filter_artists(artists: list[tuple[dict, bool]]) -> list[tuple[dict, bool]]:
    passed, dropped = [], []
    for artist, is_seed in artists:
        ok, reason = filter_artist(artist)
        if ok:
            passed.append((artist, is_seed))
        else:
            dropped.append((artist["name"], reason))

    logger.info("=== Phase 2: アーティストフィルタ: %d通過 / %d除外 ===",
                len(passed), len(dropped))
    for name, reason in dropped[:10]:  # 最初の10件のみ表示
        logger.debug("  除外: %s — %s", name, reason)
    return passed


# ---------------------------------------------------------------------------
# フェーズ3〜6: 楽曲取得・判定・スコアリング
# ---------------------------------------------------------------------------

def collect_and_score_tracks(
    sp,
    artists: list[tuple[dict, bool]],
) -> list[dict]:
    """楽曲取得 → フィルタ → Audio Features → 生演奏判定 → スコアリング。
    Returns: Supabase 投入用のレコードリスト（スコア付き）
    """
    logger.info("=== Phase 3-6: 楽曲収集・スコアリング (%d アーティスト) ===", len(artists))

    all_tracks: list[tuple[dict, dict, bool]] = []  # (track, artist, is_seed)

    for i, (artist, is_seed) in enumerate(artists, 1):
        tracks = get_artist_top_tracks(sp, artist["id"])
        time.sleep(RATE_LIMIT_SLEEP)

        passed_tracks = []
        for track in tracks:
            ok, reason = filter_track(track)
            if ok:
                passed_tracks.append(track)

        if passed_tracks:
            logger.info("  [%d/%d] %s: %d曲取得 → %d曲通過",
                        i, len(artists), artist["name"], len(tracks), len(passed_tracks))
        for track in passed_tracks:
            all_tracks.append((track, artist, is_seed))

    logger.info("楽曲フィルタ後: %d曲", len(all_tracks))
    if not all_tracks:
        logger.warning("楽曲が0件です。フィルタ条件を緩めることを検討してください。")
        return []

    # Audio Features 一括取得
    track_ids = [t["id"] for t, _, _ in all_tracks]
    logger.info("=== Phase 4: Audio Features 取得 (%d曲) ===", len(track_ids))
    features_map = get_audio_features_bulk(sp, track_ids)
    af_hit = sum(1 for v in features_map.values() if v is not None)
    logger.info("  Audio Features 取得: %d / %d", af_hit, len(track_ids))

    # 生演奏判定 + スコアリング
    records = []
    for track, artist, is_seed in all_tracks:
        af = features_map.get(track["id"])
        is_live, confidence = judge_live_performance(track, af, is_seed_artist=is_seed)
        scores = score_track(track, artist, is_live, confidence)
        rec = _build_record(track, artist, scores, is_live, af)
        records.append(rec)

    # 総合スコア降順でソート
    records.sort(key=lambda r: r.get("total_score", 0), reverse=True)
    logger.info("スコアリング完了: %d曲", len(records))
    return records


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="ゲーム音楽カバー楽曲収集スクリプト")
    parser.add_argument("--test-connection", action="store_true",
                        help="接続テスト: トークン取得と1アーティスト検索のみ実行")
    parser.add_argument("--dry-run", action="store_true",
                        help="Supabase への書き込みをスキップして結果のみ表示")
    parser.add_argument("--limit-artists", type=int, default=None,
                        help="シードアーティストの上限数（テスト用）")
    parser.add_argument("--no-related", action="store_true",
                        help="関連アーティスト拡張をスキップ")
    parser.add_argument("--top-n", type=int, default=TOP_N,
                        help=f"投入する上位N曲（デフォルト: {TOP_N}）")
    args = parser.parse_args()

    # 認証情報チェック
    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        logger.error("SPOTIFY_CLIENT_ID または SPOTIFY_CLIENT_SECRET が未設定です。")
        logger.error("python/.env に設定してください。")
        sys.exit(1)

    logger.info("Spotify クライアント初期化中...")
    sp = build_client(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET)

    # --- 接続テスト ---
    if args.test_connection:
        logger.info("=== 接続テスト ===")
        test_name, test_hint = SEED_ARTISTS[0]
        artist = search_artist(sp, test_name, test_hint)
        if artist:
            logger.info("✓ 接続成功: %s (id=%s)", artist["name"], artist["id"])
            logger.info("  followers=%s, popularity=%d",
                        artist.get("followers", {}).get("total"), artist.get("popularity", 0))
        else:
            logger.error("✗ アーティスト検索失敗")
            sys.exit(1)
        return

    # --- Phase 1: アーティスト収集 ---
    artists = collect_artists(
        sp,
        limit_artists=args.limit_artists,
        use_related=not args.no_related,
    )

    # --- Phase 2: フィルタリング ---
    artists = filter_artists(artists)

    if not artists:
        logger.error("フィルタ後にアーティストが0名になりました。中止します。")
        sys.exit(1)

    # --- Phase 3-6: 楽曲収集・スコアリング ---
    records = collect_and_score_tracks(sp, artists)

    if not records:
        logger.error("楽曲が0曲になりました。中止します。")
        sys.exit(1)

    # 上位 N 曲に絞る
    top_records = records[:args.top_n]
    logger.info("=== 投入候補: 上位 %d 曲 ===", len(top_records))
    for i, rec in enumerate(top_records[:10], 1):
        logger.info("  %2d. [%.1f] %s — %s",
                    i, rec.get("total_score", 0), rec["track_name"], rec["cover_artist"])
    if len(top_records) > 10:
        logger.info("  ... 以下 %d 曲", len(top_records) - 10)

    # --- Phase 7: Supabase 投入 ---
    if args.dry_run:
        logger.info("=== DRY RUN: Supabase への書き込みをスキップ ===")
        return

    logger.info("=== Phase 7: Supabase に投入 ===")
    inserted, updated = upsert_tracks(top_records)
    logger.info("完了: 新規追加=%d, 既存更新=%d", inserted, updated)

    total = inserted + updated
    if total < 30:
        logger.warning("⚠️  投入曲数が30曲未満です (%d曲)。フィルタ条件や拡張ロジックを見直してください。", total)
    else:
        logger.info("✓ Sprint 1 完了: %d曲を music_curation に投入しました。", total)


if __name__ == "__main__":
    main()
