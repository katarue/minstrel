"use client";

import { useState, useTransition } from "react";
import { publishEvent, deleteEvent } from "./publish-actions";

type UnpublishedEvent = {
  id: string;
  event_name: string;
  start_datetime: string | null;
  venue_name: string | null;
  prefecture: string | null;
  source_rank: string | null;
  confidence_score: number | null;
  source_url: string | null;
};

function formatDate(dt: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function PublishButton({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handlePublish = () => {
    startTransition(async () => {
      const res = await publishEvent(id);
      if (res.ok) setDone(true);
      else setError(res.message ?? "エラー");
    });
  };

  if (done) return <span className="text-xs text-success font-medium">✓ 公開済み</span>;
  if (error) return <span className="text-xs text-error">{error}</span>;

  return (
    <button
      disabled={isPending}
      onClick={handlePublish}
      className="text-xs px-3 py-1 bg-bordeaux text-parchment rounded hover:bg-bordeaux/80 disabled:opacity-40 transition-colors whitespace-nowrap"
    >
      {isPending ? "..." : "公開する"}
    </button>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteEvent(id);
      if (res.ok) setDone(true);
      else setError(res.message ?? "エラー");
    });
  };

  if (done) return <span className="text-xs text-ink-body/40">削除済み</span>;
  if (error) return <span className="text-xs text-error">{error}</span>;

  return (
    <button
      disabled={isPending}
      onClick={handleDelete}
      className="text-xs px-3 py-1 border border-error/30 text-error/70 rounded hover:bg-error/10 hover:text-error disabled:opacity-40 transition-colors whitespace-nowrap"
    >
      {isPending ? "..." : "削除する"}
    </button>
  );
}

export function UnpublishedEvents({ events }: { events: UnpublishedEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-ink-body/40 py-4 text-center">未公開イベントはありません</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gold/30 text-xs text-ink-body/50 uppercase tracking-wider">
            <th className="text-left py-2 pr-4 font-medium">イベント名</th>
            <th className="text-left py-2 pr-4 font-medium">開催日</th>
            <th className="text-left py-2 pr-4 font-medium">会場</th>
            <th className="text-left py-2 pr-4 font-medium">ランク</th>
            <th className="py-2 font-medium" colSpan={2}></th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.id} className="border-b border-gold/15 hover:bg-parchment-dark/20 transition-colors">
              <td className="py-2.5 pr-4">
                <p className="font-medium text-ink-heading leading-snug">{ev.event_name}</p>
                {ev.source_url && (
                  <a
                    href={ev.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-bordeaux/60 hover:underline truncate block max-w-xs"
                  >
                    {ev.source_url}
                  </a>
                )}
              </td>
              <td className="py-2.5 pr-4 text-ink-body/70 whitespace-nowrap">
                {formatDate(ev.start_datetime)}
              </td>
              <td className="py-2.5 pr-4 text-ink-body/70">
                {[ev.venue_name, ev.prefecture].filter(Boolean).join(" / ") || "—"}
              </td>
              <td className="py-2.5 pr-4">
                <span className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${
                  ev.source_rank === "A"
                    ? "bg-success/10 text-success border-success/30"
                    : ev.source_rank === "B"
                    ? "bg-warning/10 text-warning border-warning/30"
                    : "bg-ink-body/10 text-ink-body/50 border-ink-body/20"
                }`}>
                  {ev.source_rank ?? "C"}
                </span>
              </td>
              <td className="py-2.5 pr-2 text-right">
                <PublishButton id={ev.id} />
              </td>
              <td className="py-2.5 text-right">
                <DeleteButton id={ev.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
