"use client";

import { useState, useTransition } from "react";
import { rejectSource } from "./actions";

type RawData = {
  title?: string | null;
  start_datetime?: string | null;
  venue?: string | null;
  prefecture?: string | null;
  organizer_name?: string | null;
  confidence_score?: number | null;
  game_titles?: string[];
  ticket_url?: string | null;
  description?: string | null;
};

type ReviewSource = {
  id: string;
  source_name: string;
  source_url: string;
  raw_data: RawData;
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  x_search: {
    label: "X 検索",
    color: "bg-info/15 text-info border-info/30",
  },
  x_monitored: {
    label: "X モニタ",
    color: "bg-bordeaux/10 text-bordeaux border-bordeaux/30",
  },
};

function confidenceColor(score: number | null | undefined): string {
  if (!score) return "bg-ink-body/20";
  if (score >= 0.7) return "bg-success";
  if (score >= 0.4) return "bg-warning";
  return "bg-error";
}

function confidenceLabel(score: number | null | undefined): string {
  if (!score) return "不明";
  if (score >= 0.7) return "高";
  if (score >= 0.4) return "中";
  return "低";
}

function formatDate(dt: string | null | undefined): string {
  if (!dt) return "日時未取得";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "日時不正";
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function ReviewItem({ item }: { item: ReviewSource }) {
  const [rejected, setRejected] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rd = item.raw_data;
  const src = SOURCE_LABELS[item.source_name] ?? {
    label: item.source_name,
    color: "bg-ink-body/10 text-ink-body/60 border-ink-body/20",
  };

  if (rejected) {
    return (
      <div className="bg-parchment/40 rounded-md border border-gold/20 px-5 py-4 opacity-40">
        <span className="text-sm text-ink-body/50">却下済み</span>
      </div>
    );
  }

  return (
    <div className="bg-parchment rounded-md border border-gold/30 px-5 py-4 hover:border-gold/50 transition-all">
      {/* ヘッダー行 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`inline-block text-xs font-body font-medium px-2 py-0.5 rounded border ${src.color}`}
        >
          {src.label}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-body/60">
          <span
            className={`inline-block w-2 h-2 rounded-full ${confidenceColor(rd.confidence_score)}`}
          />
          信頼度 {confidenceLabel(rd.confidence_score)}
          {rd.confidence_score != null && (
            <span className="text-ink-body/40">
              ({Math.round(rd.confidence_score * 100)}%)
            </span>
          )}
        </span>
        <span className="text-xs text-ink-body/40 ml-auto">
          {formatDate(rd.start_datetime)}
        </span>
      </div>

      {/* タイトル */}
      <p className="font-heading text-ink-heading text-base font-semibold mb-1">
        {rd.title ?? (
          <span className="text-ink-body/30 font-normal">タイトル未取得</span>
        )}
      </p>

      {/* ゲームタイトル */}
      {rd.game_titles && rd.game_titles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {rd.game_titles.map((t) => (
            <span
              key={t}
              className="text-xs bg-bordeaux/10 text-bordeaux border border-bordeaux/20 px-2 py-0.5 rounded"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* メタ情報 */}
      <div className="text-sm text-ink-body/60 flex flex-wrap gap-x-4 gap-y-0.5 mb-3">
        {rd.organizer_name && (
          <span>主催: {rd.organizer_name}</span>
        )}
        {(rd.venue || rd.prefecture) && (
          <span>
            {[rd.venue, rd.prefecture].filter(Boolean).join(" / ")}
          </span>
        )}
        {!rd.organizer_name && !rd.venue && !rd.prefecture && (
          <span className="text-ink-body/30">会場・主催情報なし</span>
        )}
      </div>

      {/* アクション行 */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-gold/20">
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-bordeaux hover:underline truncate max-w-xs"
        >
          {item.source_url}
        </a>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await rejectSource(item.id);
              setRejected(true);
            })
          }
          className="shrink-0 text-xs px-3 py-1.5 border border-ink-body/20 text-ink-body/60 rounded hover:border-error/50 hover:text-error hover:bg-error/5 transition-colors disabled:opacity-40"
        >
          {isPending ? "処理中..." : "却下"}
        </button>
      </div>
    </div>
  );
}
