"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  updateMusicCurationStatus,
  deleteMusicCuration,
} from "./actions";
import type { MusicCuration, MusicCurationStatus } from "./types";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "./types";

function ScoreBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-body/30 text-xs">—</span>;
  const pct = Math.min(100, Math.max(0, (value / 100) * 100));
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gold/20 rounded-full overflow-hidden">
        <div className="h-full bg-bordeaux/60 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ink-body/70 font-mono tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}

function TrackRow({ track }: { track: MusicCuration }) {
  const [isPending, startTransition] = useTransition();

  const handleStatus = (status: MusicCurationStatus) =>
    startTransition(async () => { await updateMusicCurationStatus(track.id, status); });

  const handleDelete = () => {
    if (!confirm(`「${track.track_name}」を削除してもよいですか？`)) return;
    startTransition(async () => { await deleteMusicCuration(track.id); });
  };

  return (
    <tr className={`border-b border-gold/10 hover:bg-gold/5 transition-colors ${isPending ? "opacity-40" : ""}`}>
      <td className="py-3 pr-4 align-top">
        <p className="text-sm font-medium text-ink-heading leading-tight">{track.track_name}</p>
        {track.original_game && (
          <p className="text-xs text-ink-body/50 mt-0.5 leading-tight">{track.original_game}</p>
        )}
        {track.release_year && (
          <p className="text-xs text-ink-body/40">{track.release_year}</p>
        )}
      </td>

      <td className="py-3 pr-4 align-top">
        <p className="text-sm text-ink-body">{track.cover_artist}</p>
        {track.artist_monthly_listeners !== null && (
          <p className="text-xs text-ink-body/50 mt-0.5">
            {track.artist_monthly_listeners.toLocaleString()} 再生/月
          </p>
        )}
      </td>

      <td className="py-3 pr-4 align-top">
        <ScoreBar value={track.total_score} />
      </td>

      <td className="py-3 pr-4 align-top">
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[track.status]}`}>
          {STATUS_LABELS[track.status]}
        </span>
        {track.scheduled_week && (
          <p className="text-xs text-ink-body/50 mt-0.5">{track.scheduled_week}</p>
        )}
      </td>

      <td className="py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/admin/music_curation/${track.id}`}
            className="text-xs px-2 py-0.5 rounded border border-gold/30 text-ink-body/70 hover:border-bordeaux hover:text-bordeaux transition-colors whitespace-nowrap"
          >
            詳細
          </Link>

          {track.status !== "accepted" && (
            <button
              onClick={() => handleStatus("accepted")}
              disabled={isPending}
              className="text-xs px-2 py-0.5 rounded border border-success/40 text-success/70 hover:bg-success/10 hover:text-success transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              採用
            </button>
          )}
          {track.status !== "rejected" && (
            <button
              onClick={() => handleStatus("rejected")}
              disabled={isPending}
              className="text-xs px-2 py-0.5 rounded border border-error/40 text-error/70 hover:bg-error/10 hover:text-error transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              却下
            </button>
          )}
          {track.status !== "pending" && (
            <button
              onClick={() => handleStatus("pending")}
              disabled={isPending}
              className="text-xs px-2 py-0.5 rounded border border-warning/40 text-warning/70 hover:bg-warning/10 hover:text-warning transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              保留
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-xs px-2 py-0.5 rounded border border-error/30 text-error/70 hover:bg-error/10 hover:text-error transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            削除
          </button>
        </div>
      </td>
    </tr>
  );
}

export function MusicCurationListClient({ tracks }: { tracks: MusicCuration[] }) {
  if (tracks.length === 0) {
    return (
      <p className="text-sm text-ink-body/50 py-8 text-center">楽曲データがありません</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gold/20">
            {(["楽曲名 / 原曲", "カバーアーティスト", "スコア", "ステータス", "アクション"] as const).map((h) => (
              <th
                key={h}
                className="pb-2 pr-4 text-xs text-ink-body/50 uppercase tracking-wide font-medium whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tracks.map((track) => (
            <TrackRow key={track.id} track={track} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
