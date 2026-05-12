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
  | { type: "created"; eventId: string }
  | { type: "error"; message: string };

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  x_search:   { label: "X 検索",    color: "bg-info/15 text-info border-info/30" },
  x_monitored:{ label: "X モニタ",  color: "bg-bordeaux/10 text-bordeaux border-bordeaux/30" },
  x_followed: { label: "X フォロー",color: "bg-bordeaux/10 text-bordeaux border-bordeaux/30" },
};

function confidenceColor(score: number | null | undefined): string {
  if (!score) return "bg-ink-body/20";
  if (score >= 0.7) return "bg-success";
  if (score >= 0.4) return "bg-warning";
  return "bg-error";
}

function formatDate(dt: string | null | undefined): string {
  if (!dt) return "日時未取得";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "日時不正";
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function getTweetId(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}

function isXUrl(url: string): boolean {
  return url.includes("x.com") || url.includes("twitter.com");
}

export function ReviewQueue({ items }: { items: ReviewSource[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [results, setResults] = useState<Map<string, ActionResult>>(new Map());
  const [isPending, startTransition] = useTransition();

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;
  const selectedResult = selectedId ? (results.get(selectedId) ?? null) : null;
  const pendingCount = items.filter((i) => !results.has(i.id)).length;

  const advanceSelection = (processedId: string) => {
    const currentIndex = items.findIndex((i) => i.id === processedId);
    const remaining = items.filter((i) => i.id !== processedId && !results.has(i.id));
    // 次のアイテムを優先、なければ前のアイテム
    const nextCandidate = items.slice(currentIndex + 1).find((i) => !results.has(i.id));
    const next = nextCandidate ?? remaining[0];
    if (next) setSelectedId(next.id);
  };

  const handleReject = (id: string) => {
    startTransition(async () => {
      await rejectSource(id);
      setResults((prev) => new Map(prev).set(id, { type: "rejected" }));
      advanceSelection(id);
    });
  };

  const handleApprove = (id: string) => {
    startTransition(async () => {
      const res = await approveSource(id);
      let result: ActionResult;
      if (res.status === "merged") result = { type: "merged", eventId: res.eventId };
      else if (res.status === "created") result = { type: "created", eventId: res.eventId };
      else result = { type: "error", message: res.message };
      setResults((prev) => new Map(prev).set(id, result));
      if (result.type !== "error") advanceSelection(id);
    });
  };

  return (
    <div
      className="flex gap-3"
      style={{ height: "calc(100vh - 240px)", minHeight: "624px" }}
    >
      {/* 左: コンパクトリスト */}
      <div className="w-60 shrink-0 flex flex-col rounded-lg border border-gold/30 overflow-hidden">
        <div className="px-3 py-2 border-b border-gold/20 bg-parchment-dark text-sm text-ink-body/70 font-medium shrink-0">
          残り {pendingCount} / {items.length} 件
        </div>
        <div className="overflow-y-auto flex-1 bg-parchment">
          {items.map((item) => {
            const result = results.get(item.id);
            const isSelected = item.id === selectedId;
            const rd = item.raw_data;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-gold/15 transition-colors ${
                  isSelected
                    ? "bg-bordeaux/10 border-l-2 border-l-bordeaux"
                    : "hover:bg-parchment-dark/50"
                } ${result ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${confidenceColor(rd.confidence_score)}`}
                  />
                  <p className="text-sm font-semibold text-ink-heading truncate flex-1 leading-tight">
                    {rd.title ?? (
                      <span className="text-ink-body/60 font-normal italic">タイトル未取得</span>
                    )}
                  </p>
                </div>
                <p className="text-sm text-ink-body/60 pl-3">{formatDate(rd.start_datetime)}</p>
                {result && (
                  <p className="text-xs pl-3 mt-0.5 text-ink-body/60">
                    {result.type === "rejected"
                      ? "✕ 却下"
                      : result.type === "error"
                      ? "⚠ エラー"
                      : "✓ 採用"}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 右: 詳細パネル */}
      <div className="flex-1 flex flex-col rounded-lg border border-gold/30 bg-parchment overflow-hidden">
        {!selectedItem ? (
          <div className="flex items-center justify-center h-full text-ink-body/30 text-sm">
            左のリストからアイテムを選択してください
          </div>
        ) : (
          <DetailPanel
            item={selectedItem}
            result={selectedResult}
            isPending={isPending}
            onApprove={() => handleApprove(selectedItem.id)}
            onReject={() => handleReject(selectedItem.id)}
          />
        )}
      </div>
    </div>
  );
}

function DetailPanel({
  item,
  result,
  isPending,
  onApprove,
  onReject,
}: {
  item: ReviewSource;
  result: ActionResult | null;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const rd = item.raw_data;
  const src = SOURCE_LABELS[item.source_name] ?? {
    label: item.source_name,
    color: "bg-ink-body/10 text-ink-body/60 border-ink-body/20",
  };
  const score = rd.confidence_score;
  const scoreLabel = !score ? "不明" : score >= 0.7 ? "高" : score >= 0.4 ? "中" : "低";

  return (
    <div className="p-5 flex flex-col h-full gap-4">
      {/* ヘッダー行 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${src.color}`}>
          {src.label}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-ink-body/75">
          <span className={`w-2 h-2 rounded-full ${confidenceColor(score)}`} />
          信頼度 {scoreLabel}
          {score != null && (
            <span className="text-ink-body/60">({Math.round(score * 100)}%)</span>
          )}
        </span>
        <span className="text-sm text-ink-body/60 ml-auto">{formatDate(rd.start_datetime)}</span>
      </div>

      {/* タイトル・会場 */}
      <div>
        <p className="font-heading text-ink-heading text-lg font-semibold leading-snug">
          {rd.title ?? (
            <span className="text-ink-body/60 font-normal italic">タイトル未取得</span>
          )}
        </p>
        <div className="text-sm text-ink-body/75 flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
          {rd.organizer_name && <span>主催: {rd.organizer_name}</span>}
          {(rd.venue || rd.prefecture) && (
            <span>{[rd.venue, rd.prefecture].filter(Boolean).join(" / ")}</span>
          )}
        </div>
      </div>

      {/* Twitterプレビュー — 残り高さをすべて使う */}
      {isXUrl(item.source_url) ? (
        <div className="flex-1 min-h-0">
          <TwitterEmbed url={item.source_url} />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* アクション結果 */}
      {result && (
        <div
          className={`rounded-md px-4 py-3 ${
            result.type === "error"
              ? "bg-error/5 border border-error/20"
              : "bg-success/5 border border-success/20"
          }`}
        >
          {result.type === "rejected" && (
            <p className="text-sm text-ink-body/60">却下済みです</p>
          )}
          {result.type === "merged" && (
            <p className="text-sm text-success font-medium">
              ✓ 既存イベントに紐付けました（ID: {result.eventId}）
            </p>
          )}
          {result.type === "created" && (
            <p className="text-sm text-success font-medium">
              ✓ 新規登録しました（未公開）— Supabase で is_published = true にすると公開
            </p>
          )}
          {result.type === "error" && (
            <p className="text-sm text-error">⚠ {result.message}</p>
          )}
        </div>
      )}

      {/* ソースURL + ボタン */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-gold/20">
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-bordeaux hover:underline truncate max-w-sm"
        >
          {item.source_url}
        </a>
        {!result || result.type === "error" ? (
          <div className="flex gap-2 shrink-0">
            <button
              disabled={isPending}
              onClick={onApprove}
              className="text-sm px-4 py-2 bg-bordeaux text-parchment rounded hover:bg-bordeaux/80 transition-colors disabled:opacity-40"
            >
              {isPending ? "処理中..." : "採用"}
            </button>
            <button
              disabled={isPending}
              onClick={onReject}
              className="text-sm px-4 py-2 border border-ink-body/20 text-ink-body/75 rounded hover:border-error/50 hover:text-error hover:bg-error/5 transition-colors disabled:opacity-40"
            >
              却下
            </button>
          </div>
        ) : (
          <span className="text-sm text-ink-body/60">処理済み</span>
        )}
      </div>
    </div>
  );
}

function TwitterEmbed({ url }: { url: string }) {
  const tweetId = getTweetId(url);
  if (!tweetId) return null;

  return (
    <div className="h-full rounded-md overflow-hidden border border-gold/20 bg-white">
      <iframe
        src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&dnt=true&lang=ja`}
        style={{ width: "100%", height: "100%", border: "none" }}
        title="ツイートプレビュー"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
