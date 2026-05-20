import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { MusicCuration, MusicCurationStatus } from "../types";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "../types";
import { MusicCurationDetailClient } from "./MusicCurationDetailClient";

export const revalidate = 0;

async function getTrack(id: string): Promise<MusicCuration | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("music_curation")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as MusicCuration;
}

function ScoreRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gold/10 last:border-0">
      <span className="text-xs text-ink-body/60">{label}</span>
      {value !== null ? (
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-gold/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-bordeaux/60 rounded-full"
              style={{ width: `${Math.min(100, (value / 100) * 100)}%` }}
            />
          </div>
          <span className="text-sm font-mono text-ink-body tabular-nums w-10 text-right">
            {value.toFixed(1)}
          </span>
        </div>
      ) : (
        <span className="text-xs text-ink-body/30">—</span>
      )}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-4 py-1.5 border-b border-gold/10 last:border-0">
      <span className="text-xs text-ink-body/50 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-ink-body break-all">
        {value !== null && value !== undefined ? String(value) : <span className="text-ink-body/30">—</span>}
      </span>
    </div>
  );
}

export default async function MusicCurationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const track = await getTrack(id);
  if (!track) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* パンくず */}
      <div className="flex items-center gap-2 text-xs text-ink-body/40">
        <Link href="/admin" className="hover:text-bordeaux transition-colors">ダッシュボード</Link>
        <span>/</span>
        <Link href="/admin/music_curation" className="hover:text-bordeaux transition-colors">楽曲キュレーション</Link>
        <span>/</span>
        <span className="text-ink-body/70">{track.track_name}</span>
      </div>

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-ink-heading text-xl font-semibold">{track.track_name}</h1>
          {track.original_game && (
            <p className="text-sm text-ink-body/60 mt-0.5">{track.original_game}{track.release_year ? ` (${track.release_year})` : ""}</p>
          )}
        </div>
        <span className={`inline-block text-sm font-semibold px-3 py-1 rounded-full shrink-0 mt-1 ${STATUS_BADGE_CLASS[track.status]}`}>
          {STATUS_LABELS[track.status]}
        </span>
      </div>

      {/* ステータス操作 + メモ（Client Component） */}
      <MusicCurationDetailClient track={track} />

      {/* 楽曲情報 */}
      <section className="bg-parchment rounded-md border border-gold/30 px-5 py-4">
        <h2 className="text-xs font-semibold text-ink-body/50 uppercase tracking-widest mb-3">楽曲情報</h2>
        <FieldRow label="カバーアーティスト" value={track.cover_artist} />
        <FieldRow label="Spotify Artist ID" value={track.cover_artist_spotify_id} />
        <FieldRow label="月間再生数" value={track.artist_monthly_listeners?.toLocaleString() ?? null} />
        <FieldRow label="作曲者" value={track.composer} />
        <FieldRow label="ライブ演奏" value={track.is_live_performance === null ? null : track.is_live_performance ? "Yes" : "No"} />
        <FieldRow label="Hi-Res 音源" value={track.hi_res_available ? "あり" : "なし"} />
      </section>

      {/* リンク */}
      <section className="bg-parchment rounded-md border border-gold/30 px-5 py-4">
        <h2 className="text-xs font-semibold text-ink-body/50 uppercase tracking-widest mb-3">リンク</h2>
        {track.spotify_url ? (
          <FieldRow label="Spotify" value={track.spotify_url} />
        ) : (
          <FieldRow label="Spotify" value={null} />
        )}
        {track.amazon_music_url ? (
          <FieldRow label="Amazon Music" value={track.amazon_music_url} />
        ) : (
          <FieldRow label="Amazon Music" value={null} />
        )}
        {track.youtube_url ? (
          <FieldRow label="YouTube" value={track.youtube_url} />
        ) : (
          <FieldRow label="YouTube" value={null} />
        )}
      </section>

      {/* スコア */}
      <section className="bg-parchment rounded-md border border-gold/30 px-5 py-4">
        <h2 className="text-xs font-semibold text-ink-body/50 uppercase tracking-widest mb-3">スコア</h2>
        <ScoreRow label="認知度 (awareness)" value={track.awareness_score} />
        <ScoreRow label="技術力 (skill)" value={track.skill_score} />
        <ScoreRow label="感情表現 (emotion)" value={track.emotion_score} />
        <ScoreRow label="安定感 (stability)" value={track.stability_score} />
        <div className="mt-2 pt-2 border-t border-gold/20">
          <ScoreRow label="総合スコア" value={track.total_score} />
        </div>
      </section>

      {/* Acoustics */}
      <section className="bg-parchment rounded-md border border-gold/30 px-5 py-4">
        <h2 className="text-xs font-semibold text-ink-body/50 uppercase tracking-widest mb-3">音響特性</h2>
        <ScoreRow label="acousticness" value={track.acousticness !== null ? track.acousticness * 100 : null} />
        <ScoreRow label="instrumentalness" value={track.instrumentalness !== null ? track.instrumentalness * 100 : null} />
        <ScoreRow label="energy" value={track.energy !== null ? track.energy * 100 : null} />
        <ScoreRow label="liveness" value={track.liveness !== null ? track.liveness * 100 : null} />
      </section>

      {/* メタ */}
      <section className="bg-parchment rounded-md border border-gold/30 px-5 py-4">
        <h2 className="text-xs font-semibold text-ink-body/50 uppercase tracking-widest mb-3">スケジュール</h2>
        <FieldRow label="配信週" value={track.scheduled_week} />
        <FieldRow label="予約投稿 ID" value={track.scheduled_post_id} />
      </section>
    </div>
  );
}
