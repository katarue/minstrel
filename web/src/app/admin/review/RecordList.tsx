"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { publishEvent, unpublishEvent, deleteEvent } from "./publish-actions";
import { reresearchEvent } from "./research-actions";

export type EventRecord = {
  id: string;
  event_name: string;
  start_datetime: string | null;
  venue_name: string | null;
  prefecture: string | null;
  source_url: string | null;
  flyer_image_url: string | null;
  key_visual_url: string | null;
  is_published: boolean;
  organizers: { name: string } | null;
  event_game_titles: Array<{ game_titles: { title_name: string } | null }>;
};

type Filter = "all" | "unpublished" | "published";

function formatDate(dt: string | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "";
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}/${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
}

function formatTime(dt: string | null): string {
  if (!dt) return "";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "";
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const h = jst.getUTCHours();
  const m = jst.getUTCMinutes();
  if (h === 0 && m === 0) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getMissingFields(ev: EventRecord): string[] {
  const missing: string[] = [];
  if (!ev.flyer_image_url && !ev.key_visual_url) missing.push("画像");
  if (!ev.organizers?.name)                       missing.push("主催者");
  if (!ev.venue_name)                             missing.push("会場");
  if (!ev.prefecture)                             missing.push("都道府県");
  if (!ev.start_datetime)                         missing.push("日付");
  else if (!formatTime(ev.start_datetime))        missing.push("時間");
  if (!ev.source_url)                             missing.push("URL");
  return missing;
}

function Empty({ label }: { label: string }) {
  return <span className="text-error text-xs font-medium">✗ {label}</span>;
}

function ImageModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div className="relative" onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-md" />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white text-sm hover:bg-black/80 flex items-center justify-center"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function RowActions({
  ev,
  onResearchMsg,
  urlOverride,
}: {
  ev: EventRecord;
  onResearchMsg: (msg: string) => void;
  urlOverride: string;
}) {
  const [done, setDone] = useState<"published" | "unpublished" | "deleted" | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isResearching, startResearch] = useTransition();

  const missing = getMissingFields(ev);
  const canPublish = missing.length === 0;

  const handlePublish = () =>
    startTransition(async () => {
      const res = await publishEvent(ev.id);
      if (res.ok) setDone("published");
      else setError(res.message ?? "エラー");
    });

  const handleUnpublish = () =>
    startTransition(async () => {
      const res = await unpublishEvent(ev.id);
      if (res.ok) setDone("unpublished");
      else setError(res.message ?? "エラー");
    });

  const handleDelete = () =>
    startTransition(async () => {
      const res = await deleteEvent(ev.id);
      if (res.ok) setDone("deleted");
      else setError(res.message ?? "エラー");
    });

  const handleResearch = () =>
    startResearch(async () => {
      const res = await reresearchEvent(ev.id, urlOverride || undefined);
      onResearchMsg(res.message ?? (res.ok ? "完了" : "エラー"));
    });

  if (done === "deleted")     return <span className="text-xs text-ink-body/40">削除済み</span>;
  if (done === "published")   return <span className="text-xs text-success font-medium">✓ 公開済み</span>;
  if (done === "unpublished") return <span className="text-xs text-warning font-medium">非公開に変更</span>;
  if (error)                  return <span className="text-xs text-error">{error}</span>;

  return (
    <div className="flex flex-col gap-1.5 items-end min-w-[80px]">
      {ev.is_published ? (
        <button
          disabled={isPending}
          onClick={handleUnpublish}
          className="text-xs px-2.5 py-1 border border-warning/40 text-warning rounded hover:bg-warning/10 disabled:opacity-40 whitespace-nowrap"
        >
          非公開に
        </button>
      ) : (
        <>
          <button
            disabled={isPending || isResearching}
            onClick={handleResearch}
            className="text-xs px-2.5 py-1 border border-gold/40 text-ink-body/60 rounded hover:bg-gold/10 disabled:opacity-40 whitespace-nowrap"
          >
            {isResearching ? "検索中..." : "再リサーチ"}
          </button>
          <button
            disabled={isPending || isResearching || !canPublish}
            onClick={handlePublish}
            title={!canPublish ? `不足: ${missing.join("、")}` : ""}
            className="text-xs px-2.5 py-1 bg-bordeaux text-parchment rounded hover:bg-bordeaux/80 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isPending ? "..." : "公開する"}
          </button>
        </>
      )}
      <button
        disabled={isPending || isResearching}
        onClick={handleDelete}
        className="text-xs px-2.5 py-1 border border-error/30 text-error/70 rounded hover:bg-error/10 hover:text-error disabled:opacity-40 whitespace-nowrap"
      >
        削除する
      </button>
    </div>
  );
}

export function RecordList({ events }: { events: EventRecord[] }) {
  const [filter, setFilter] = useState<Filter>("unpublished");
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [researchMsgs, setResearchMsgs] = useState<Record<string, string>>({});
  const [urlOverrides, setUrlOverrides] = useState<Record<string, string>>({});

  const publishedCount   = events.filter(e => e.is_published).length;
  const unpublishedCount = events.filter(e => !e.is_published).length;

  const filtered = events.filter(ev => {
    if (filter === "published")   return ev.is_published;
    if (filter === "unpublished") return !ev.is_published;
    return true;
  });

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "unpublished", label: "未公開",   count: unpublishedCount },
    { key: "published",   label: "公開済み", count: publishedCount },
    { key: "all",         label: "全件",     count: events.length },
  ];

  return (
    <div className="space-y-3">
      {/* フィルタタブ */}
      <div className="flex gap-2 text-xs">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.key
                ? "bg-bordeaux text-parchment border-bordeaux"
                : "border-gold/40 text-ink-body/60 hover:border-gold hover:text-ink-body"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gold/30 text-xs text-ink-body/50 uppercase tracking-wider">
              <th className="text-left py-2 pr-2 font-medium w-40">画像</th>
              <th className="text-left py-2 pr-2 font-medium min-w-[150px]">イベント名</th>
              <th className="text-left py-2 pr-2 font-medium whitespace-nowrap">日付</th>
              <th className="text-left py-2 pr-2 font-medium whitespace-nowrap">時間</th>
              <th className="text-left py-2 pr-2 font-medium min-w-[110px]">会場</th>
              <th className="text-left py-2 pr-2 font-medium w-20">都道府県</th>
              <th className="text-left py-2 pr-2 font-medium min-w-[80px]">主催者</th>
              <th className="text-left py-2 pr-2 font-medium min-w-[100px]">ゲームタイトル</th>
              <th className="text-left py-2 pr-2 font-medium whitespace-nowrap">状態</th>
              <th className="text-right py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-ink-body/40 text-sm">
                  該当するレコードはありません
                </td>
              </tr>
            )}
            {filtered.map(ev => {
              const missing    = getMissingFields(ev);
              const imageUrl   = ev.flyer_image_url ?? ev.key_visual_url;
              const date       = formatDate(ev.start_datetime);
              const time       = formatTime(ev.start_datetime);
              const gameTitles = ev.event_game_titles
                .map(e => e.game_titles?.title_name)
                .filter((t): t is string => !!t);
              const researchMsg = researchMsgs[ev.id];

              return (
                <tr
                  key={ev.id}
                  className={`border-b border-gold/15 align-top ${
                    ev.is_published
                      ? "hover:bg-success/5"
                      : missing.length > 0
                      ? "bg-error/[0.03] hover:bg-error/5"
                      : "hover:bg-parchment-dark/20"
                  }`}
                >
                  {/* 画像 */}
                  <td className="py-2 pr-2">
                    {imageUrl ? (
                      <div
                        className="relative w-36 h-36 rounded overflow-hidden bg-parchment-dark cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setModalImage(imageUrl)}
                      >
                        <Image src={imageUrl} alt="" fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-36 h-36 rounded bg-error/10 flex items-center justify-center">
                        <span className="text-error text-xs">✗</span>
                      </div>
                    )}
                  </td>

                  {/* イベント名 + URL */}
                  <td className="py-2.5 pr-2">
                    <p className="font-medium text-ink-heading leading-snug line-clamp-2 text-xs">
                      {ev.event_name}
                    </p>
                    {!ev.is_published ? (
                      <>
                        <input
                          type="url"
                          value={urlOverrides[ev.id] ?? ev.source_url ?? ""}
                          onChange={e => setUrlOverrides(prev => ({ ...prev, [ev.id]: e.target.value }))}
                          className="mt-1 w-full text-xs text-bordeaux/70 bg-transparent border-b border-gold/40 focus:border-bordeaux outline-none py-0.5"
                          placeholder="URLを入力..."
                        />
                        {(urlOverrides[ev.id] ?? ev.source_url) && (
                          <a
                            href={urlOverrides[ev.id] ?? ev.source_url ?? ""}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-0.5 text-[10px] text-ink-body/40 hover:text-bordeaux transition-colors"
                          >
                            ↗ 開く
                          </a>
                        )}
                      />
                    ) : ev.source_url ? (
                      <a
                        href={ev.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-bordeaux/60 hover:underline truncate block max-w-[160px]"
                      >
                        {ev.source_url}
                      </a>
                    ) : (
                      <Empty label="URLなし" />
                    )}
                  </td>

                  {/* 日付 */}
                  <td className="py-2.5 pr-2 whitespace-nowrap">
                    {date
                      ? <span className="text-ink-body/80 text-xs">{date}</span>
                      : <Empty label="日付なし" />
                    }
                  </td>

                  {/* 時間 */}
                  <td className="py-2.5 pr-2 whitespace-nowrap">
                    {time
                      ? <span className="text-ink-body/80 text-xs">{time}</span>
                      : <Empty label="時間なし" />
                    }
                  </td>

                  {/* 会場 */}
                  <td className="py-2.5 pr-2">
                    {ev.venue_name
                      ? <span className="text-ink-body/80 text-xs leading-snug">{ev.venue_name}</span>
                      : <Empty label="会場なし" />
                    }
                  </td>

                  {/* 都道府県 */}
                  <td className="py-2.5 pr-2">
                    {ev.prefecture
                      ? <span className="text-ink-body/80 text-xs">{ev.prefecture}</span>
                      : <Empty label="都道府県なし" />
                    }
                  </td>

                  {/* 主催者 */}
                  <td className="py-2.5 pr-2">
                    {ev.organizers?.name
                      ? <span className="text-ink-body/80 text-xs leading-snug">{ev.organizers.name}</span>
                      : <Empty label="主催者なし" />
                    }
                  </td>

                  {/* ゲームタイトル */}
                  <td className="py-2.5 pr-2">
                    {gameTitles.length > 0 ? (
                      <span className="text-ink-body/80 text-xs">
                        {gameTitles[0]}
                        {gameTitles.length > 1 && (
                          <span className="text-ink-body/40 ml-1">+{gameTitles.length - 1}</span>
                        )}
                      </span>
                    ) : (
                      <Empty label="タイトルなし" />
                    )}
                  </td>

                  {/* 状態 */}
                  <td className="py-2.5 pr-2 whitespace-nowrap">
                    {ev.is_published ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success font-medium bg-success/10 px-2 py-0.5 rounded-full">
                        ● 公開中
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-body/40 bg-parchment-dark/40 px-2 py-0.5 rounded-full">
                        ○ 未公開
                      </span>
                    )}
                  </td>

                  {/* 操作 */}
                  <td className="py-2.5 text-right">
                    {researchMsg && (
                      <div className="text-xs text-ink-body/50 text-right mb-1 leading-tight max-w-[100px] ml-auto">
                        {researchMsg}
                      </div>
                    )}
                    <RowActions
                      ev={ev}
                      onResearchMsg={msg =>
                        setResearchMsgs(prev => ({ ...prev, [ev.id]: msg }))
                      }
                      urlOverride={urlOverrides[ev.id] ?? ev.source_url ?? ""}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalImage && <ImageModal url={modalImage} onClose={() => setModalImage(null)} />}
    </div>
  );
}
