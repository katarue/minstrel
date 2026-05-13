"use client";

import { useState, useTransition } from "react";
import { rejectSource, approveSource } from "./actions";

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

type ActionResult =
  | { type: "rejected" }
  | { type: "merged"; eventId: string }
  | { type: "created"; eventId: string; enriched: boolean }
  | { type: "error"; message: string };

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  x_search: { label: "X 検索", color: "bg-info/15 text-info border-info/30" },
  x_monitored: { label: "X モニタ", color: "bg-bordeaux/10 text-bordeaux border-bordeaux/30" },
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
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const rd = item.raw_data;
  const src = SOURCE_LABELS[item.source_name] ?? {
    label: item.source_name,
    color: "bg-ink-body/10 text-ink-body/60 border-ink-body/20",
  };

  const handleReject = () => {
    startTransition(async () => {
      await rejectSource(item.id);
      setResult({ type: "rejected" });
    });
  };

  const handleApprove = () => {
    startTransition(async () => {
      const res = await approveSource(item.id);
      if (res.status === "merged") setResult({ type: "merged", eventId: res.eventId });
      else if (res.status === "created") setResult({ type: "created", eventId: res.eventId, enriched: res.enriched });
      else setResult({ type: "error", message: res.message });
    });
  };

  // 処理済み表示
  if (result?.type === "rejected") {
    return (
      <div className="bg-parchment/40 rounded-md border border-gold/20 px-5 py-4 opacity-40">
        <span className="text-sm text-ink-body/50">却下済み</span>
      </div>
    );
  }

  if (result?.type === "merged") {
    return (
      <div className="bg-success/5 rounded-md border border-success/30 px-5 py-4">
        <p className="text-sm text-success font-medium">✓ 既存イベントに紐付けました</p>
        <p className="text-xs text-ink-body/50 mt-0.5">event_id: {result.eventId}</p>
      </div>
    );
  }

  if (result?.type === "created") {
    return (
      <div className="bg-success/5 rounded-md border border-success/30 px-5 py-4">
        <p className="text-sm text-success font-medium">✓ 新規登録しました（未公開）</p>
        {result.enriched && (
          <p className="text-xs text-info mt-0.5">公式ページから日時・会場を自動補完しました</p>
        )}
        <p className="text-xs text-ink-body/50 mt-0.5">Supabase で内容を確認後、is_published を true にすると公開されます</p>
      </div>
    );
  }

  return (
    <div className="bg-parchment rounded-md border border-gold/30 px-5 py-4 hover:border-gold/50 transition-all">
      {/* ヘッダー行 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-block text-xs font-body font-medium px-2 py-0.5 rounded border ${src.color}`}>
          {src.label}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-body/60">
          <span className={`inline-block w-2 h-2 rounded-full ${confidenceColor(rd.confidence_score)}`} />
          信頼度 {confidenceLabel(rd.confidence_score)}
          {rd.confidence_score != null && (
            <span className="text-ink-body/40">({Math.round(rd.confidence_score * 100)}%)</span>
          )}
        </span>
        <span className="text-xs text-ink-body/40 ml-auto">{formatDate(rd.start_datetime)}</span>
      </div>

      {/* タイトル */}
      <p className="font-heading text-ink-heading text-base font-semibold mb-1">
        {rd.title ?? <span className="text-ink-body/30 font-normal">タイトル未取得</span>}
      </p>

      {/* ゲームタイトル */}
      {rd.game_titles && rd.game_titles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {rd.game_titles.map((t) => (
            <span key={t} className="text-xs bg-bordeaux/10 text-bordeaux border border-bordeaux/20 px-2 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* メタ情報 */}
      <div className="text-sm text-ink-body/60 flex flex-wrap gap-x-4 gap-y-0.5 mb-3">
        {rd.organizer_name && <span>主催: {rd.organizer_name}</span>}
        {(rd.venue || rd.prefecture) && (
          <span>{[rd.venue, rd.prefecture].filter(Boolean).join(" / ")}</span>
        )}
        {!rd.organizer_name && !rd.venue && !rd.prefecture && (
          <span className="text-ink-body/30">会場・主催情報なし</span>
        )}
      </div>

      {/* エラー表示 */}
      {result?.type === "error" && (
        <p className="text-xs text-error mb-3 bg-error/5 border border-error/20 rounded px-3 py-2">
          ⚠ {result.message}
        </p>
      )}

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
        <div className="flex gap-2 shrink-0">
          <button
            disabled={isPending}
            onClick={handleApprove}
            className="text-xs px-3 py-1.5 bg-bordeaux text-parchment rounded hover:bg-bordeaux/80 transition-colors disabled:opacity-40"
          >
            {isPending ? "処理中..." : "採用"}
          </button>
          <button
            disabled={isPending}
            onClick={handleReject}
            className="text-xs px-3 py-1.5 border border-ink-body/20 text-ink-body/60 rounded hover:border-error/50 hover:text-error hover:bg-error/5 transition-colors disabled:opacity-40"
          >
            却下
          </button>
        </div>
      </div>
    </div>
  );
}
