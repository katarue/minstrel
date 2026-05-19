"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { publishEvent, unpublishEvent, deleteEvent, clearEventImage, saveOfficialUrl, saveReferenceUrl, saveSourceUrl, updateGameTitles, saveImageFromUrl, saveDescription, saveSeriesName, saveTicketSaleStart } from "./publish-actions";
import { reresearchEvent, generateDescription } from "./research-actions";

export type EventRecord = {
  id: string;
  event_name: string;
  series_name: string | null;
  start_datetime: string | null;
  venue_name: string | null;
  prefecture: string | null;
  description: string | null;
  ticket_sale_start: string | null;
  source_url: string | null;
  official_url: string | null;
  reference_url: string | null;
  flyer_image_url: string | null;
  key_visual_url: string | null;
  is_published: boolean;
  organizers: { name: string } | null;
  event_game_titles: Array<{ game_titles: { title_name: string } | null }>;
  event_sources: Array<{ source_name: string; raw_data: { game_music_reason?: string; [key: string]: unknown } }> | null;
};

type Filter = "unpublished" | "published" | "upcoming" | "archive";

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

function getDuplicateIds(events: EventRecord[]): Set<string> {
  const seen = new Map<string, string>();
  const dupes = new Set<string>();
  for (const ev of events) {
    if (!ev.start_datetime) continue;
    const key = `${ev.event_name}|${ev.start_datetime}|${(ev.venue_name ?? "").replace(/\s/g, "")}`;
    const prev = seen.get(key);
    if (prev) {
      dupes.add(ev.id);
      dupes.add(prev);
    } else {
      seen.set(key, ev.id);
    }
  }
  return dupes;
}

function getMissingFields(ev: EventRecord): string[] {
  const missing: string[] = [];
  if (!ev.flyer_image_url && !ev.key_visual_url) missing.push("画像");
  if (!ev.venue_name)                             missing.push("会場");
  if (!ev.prefecture)                             missing.push("都道府県");
  if (!ev.start_datetime)                         missing.push("日付");
  else if (!formatTime(ev.start_datetime))        missing.push("時間");
  if (!ev.source_url)                             missing.push("URL");
  return missing;
}

function Empty({ label }: { label: string }) {
  return <span className="text-red-600 text-sm font-bold">✗ {label}</span>;
}

function ImageCell({ ev, onOpenModal }: { ev: EventRecord; onOpenModal: (url: string) => void }) {
  const [cleared, setCleared] = useState(false);
  const [isPending, startTransition] = useTransition();
  const imageUrl = cleared ? null : (ev.flyer_image_url ?? ev.key_visual_url);

  if (!imageUrl) {
    return (
      <div className="w-36 h-36 rounded bg-error/10 flex items-center justify-center">
        <span className="text-error text-xs">✗</span>
      </div>
    );
  }

  return (
    <div className="relative w-36 h-36 group">
      <div
        className="relative w-full h-full rounded overflow-hidden bg-parchment-dark cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => onOpenModal(imageUrl)}
      >
        <Image src={imageUrl} alt="" fill className="object-cover" />
      </div>
      <button
        onClick={() => startTransition(async () => {
          const res = await clearEventImage(ev.id);
          if (res.ok) setCleared(true);
        })}
        disabled={isPending}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] hover:bg-error/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
        title="画像を削除"
      >
        ✕
      </button>
    </div>
  );
}

function GameTitleField({ eventId, initialTitles }: { eventId: string; initialTitles: string[] }) {
  const [value, setValue] = useState(initialTitles.join("、"));
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dirty = value !== initialTitles.join("、");

  const handleSave = () =>
    startTransition(async () => {
      const titles = value.split(/[,、，]/).map(t => t.trim()).filter(Boolean);
      const res = await updateGameTitles(eventId, titles);
      if (res.ok) setSaved(true);
    });

  const currentTitles = value.split(/[,、，]/).map(t => t.trim()).filter(Boolean);

  return (
    <div>
      {currentTitles.length > 0 && (
        <ul className="mb-1.5 space-y-0.5">
          {currentTitles.map((t, i) => (
            <li key={i} className="text-sm text-ink-body leading-snug">・{t}</li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setSaved(false); }}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          className="flex-1 min-w-0 text-xs bg-transparent border-b border-gold/40 focus:border-bordeaux outline-none py-0.5 text-ink-body/70"
          placeholder="カンマ区切りで入力"
        />
        {dirty && !saved && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs px-1.5 py-0.5 bg-gold/20 text-ink-body/70 rounded hover:bg-gold/30 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {isPending ? "…" : "保存"}
          </button>
        )}
        {saved && <span className="text-xs text-success shrink-0">✓</span>}
      </div>
    </div>
  );
}

function TicketSaleDateField({ eventId, initialDate }: { eventId: string; initialDate: string | null }) {
  const [value, setValue] = useState(initialDate ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dirty = value !== (initialDate ?? "");

  const handleSave = () =>
    startTransition(async () => {
      const res = await saveTicketSaleStart(eventId, value);
      if (res.ok) setSaved(true);
    });

  return (
    <div className="mt-1">
      <span className="text-xs text-ink-body/70 uppercase tracking-wide">発売開始日</span>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={value}
          onChange={e => { setValue(e.target.value); setSaved(false); }}
          className={`flex-1 min-w-0 text-sm bg-transparent border-b focus:border-bordeaux outline-none py-0.5 ${value ? "text-ink-body border-gold/40" : "text-error border-error/40"}`}
        />
        {dirty && !saved && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs px-1.5 py-0.5 bg-gold/20 text-ink-body/70 rounded hover:bg-gold/30 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {isPending ? "…" : "保存"}
          </button>
        )}
        {saved && <span className="text-xs text-success shrink-0">✓</span>}
      </div>
    </div>
  );
}

function SeriesNameField({ eventId, initialName }: { eventId: string; initialName: string | null }) {
  const [value, setValue] = useState(initialName ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dirty = value !== (initialName ?? "");

  const handleSave = () =>
    startTransition(async () => {
      const res = await saveSeriesName(eventId, value);
      if (res.ok) setSaved(true);
    });

  return (
    <div className="mt-1">
      <span className="text-xs text-ink-body/70 uppercase tracking-wide">イベント名</span>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setSaved(false); }}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          className="flex-1 min-w-0 text-sm text-ink-body bg-transparent border-b border-gold/40 focus:border-bordeaux outline-none py-0.5"
          placeholder="例: BRA★BRA FINAL FANTASY 2026"
        />
        {dirty && !saved && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs px-1.5 py-0.5 bg-gold/20 text-ink-body/70 rounded hover:bg-gold/30 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {isPending ? "…" : "保存"}
          </button>
        )}
        {saved && <span className="text-xs text-success shrink-0">✓</span>}
      </div>
    </div>
  );
}

function OfficialUrlField({ eventId, initialUrl }: { eventId: string; initialUrl: string | null }) {
  const [value, setValue] = useState(initialUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dirty = value !== (initialUrl ?? "");

  const handleSave = () =>
    startTransition(async () => {
      const res = await saveOfficialUrl(eventId, value);
      if (res.ok) setSaved(true);
    });

  return (
    <div className="mt-1.5">
      <span className="text-xs text-ink-body/70 uppercase tracking-wide">公式</span>
      <div className="flex items-center gap-1">
        <input
          type="url"
          value={value}
          onChange={e => { setValue(e.target.value); setSaved(false); }}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          className="flex-1 min-w-0 text-sm text-bordeaux/90 bg-transparent border-b border-gold/40 focus:border-bordeaux outline-none py-0.5"
          placeholder="公式サイトURL..."
        />
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="text-xs text-ink-body/60 hover:text-bordeaux transition-colors whitespace-nowrap shrink-0">
            ↗
          </a>
        )}
        {dirty && !saved && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs px-1.5 py-0.5 bg-gold/20 text-ink-body/70 rounded hover:bg-gold/30 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {isPending ? "…" : "保存"}
          </button>
        )}
        {saved && <span className="text-[10px] text-success shrink-0">✓</span>}
      </div>
    </div>
  );
}

function ReferenceUrlField({ eventId, initialUrl }: { eventId: string; initialUrl: string | null }) {
  const [value, setValue] = useState(initialUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dirty = value !== (initialUrl ?? "");

  const handleSave = () =>
    startTransition(async () => {
      const res = await saveReferenceUrl(eventId, value);
      if (res.ok) setSaved(true);
    });

  return (
    <div className="mt-1.5">
      <span className="text-xs text-ink-body/70 uppercase tracking-wide">参考</span>
      <div className="flex items-center gap-1">
        <input
          type="url"
          value={value}
          onChange={e => { setValue(e.target.value); setSaved(false); }}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          className="flex-1 min-w-0 text-sm text-bordeaux/90 bg-transparent border-b border-gold/40 focus:border-bordeaux outline-none py-0.5"
          placeholder="その他参考URL（X投稿など）..."
        />
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="text-xs text-ink-body/60 hover:text-bordeaux transition-colors whitespace-nowrap shrink-0">
            ↗
          </a>
        )}
        {dirty && !saved && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs px-1.5 py-0.5 bg-gold/20 text-ink-body/70 rounded hover:bg-gold/30 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {isPending ? "…" : "保存"}
          </button>
        )}
        {saved && <span className="text-[10px] text-success shrink-0">✓</span>}
      </div>
    </div>
  );
}

function SourceUrlField({
  eventId,
  initialUrl,
  onValueChange,
}: {
  eventId: string;
  initialUrl: string | null;
  onValueChange?: (url: string) => void;
}) {
  const [value, setValue] = useState(initialUrl ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dirty = value !== (initialUrl ?? "");

  const handleSave = () =>
    startTransition(async () => {
      const res = await saveSourceUrl(eventId, value);
      if (res.ok) setSaved(true);
    });

  return (
    <div className="mt-1">
      <span className="text-xs text-ink-body/70 uppercase tracking-wide">チケット</span>
      <div className="flex items-center gap-1">
        <input
          type="url"
          value={value}
          onChange={e => {
            setValue(e.target.value);
            setSaved(false);
            onValueChange?.(e.target.value);
          }}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          className="flex-1 min-w-0 text-sm text-bordeaux/90 bg-transparent border-b border-gold/40 focus:border-bordeaux outline-none py-0.5"
          placeholder="チケットページURL..."
        />
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="text-xs text-ink-body/60 hover:text-bordeaux transition-colors whitespace-nowrap shrink-0">
            ↗
          </a>
        )}
        {dirty && !saved && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs px-1.5 py-0.5 bg-gold/20 text-ink-body/70 rounded hover:bg-gold/30 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {isPending ? "…" : "保存"}
          </button>
        )}
        {saved && <span className="text-[10px] text-success shrink-0">✓</span>}
      </div>
    </div>
  );
}

function ManualImageUrlField({ eventId, initialUrl }: { eventId: string; initialUrl?: string | null }) {
  const [value, setValue] = useState(initialUrl ?? "");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSave = () =>
    startTransition(async () => {
      if (!value.trim()) return;
      const res = await saveImageFromUrl(eventId, value.trim());
      if (res.ok) { setStatus("ok"); }
      else { setStatus("error"); setErrMsg(res.message ?? "エラー"); }
    });

  return (
    <div className="mt-1.5">
      <span className="text-xs text-ink-body/70 uppercase tracking-wide">画像URL</span>
      <div className="flex items-center gap-1">
        <input
          type="url"
          value={value}
          onChange={e => { setValue(e.target.value); setStatus("idle"); }}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          className="flex-1 min-w-0 text-sm text-bordeaux/90 bg-transparent border-b border-gold/40 focus:border-bordeaux outline-none py-0.5"
          placeholder="画像URLを貼り付け..."
        />
        {value.trim() && value !== (initialUrl ?? "") && status === "idle" && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs px-1.5 py-0.5 bg-gold/20 text-ink-body/70 rounded hover:bg-gold/30 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {isPending ? "…" : "保存"}
          </button>
        )}
        {status === "ok" && <span className="text-[10px] text-success shrink-0">✓ 保存済み</span>}
        {status === "error" && <span className="text-[10px] text-error shrink-0" title={errMsg}>✗ {errMsg}</span>}
      </div>
    </div>
  );
}

function DescriptionCell({ eventId, initialDescription }: { eventId: string; initialDescription: string | null }) {
  const [value, setValue] = useState(initialDescription ?? "");
  const [saved, setSaved] = useState(false);
  const [genError, setGenError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerate] = useTransition();
  const dirty = value !== (initialDescription ?? "");

  const handleSave = () =>
    startTransition(async () => {
      const res = await saveDescription(eventId, value);
      if (res.ok) setSaved(true);
    });

  const handleGenerate = () => {
    setGenError("");
    startGenerate(async () => {
      const res = await generateDescription(eventId);
      if (res.ok && res.text) {
        setValue(res.text);
        setSaved(false);
      } else {
        setGenError(res.message ?? "生成に失敗しました");
      }
    });
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || isPending}
          className="text-xs px-2 py-0.5 border border-gold/50 text-ink-body/70 rounded hover:bg-gold/15 hover:text-ink-body disabled:opacity-40 whitespace-nowrap"
        >
          {isGenerating ? "生成中..." : "✦ 自動生成"}
        </button>
        {genError && <span className="text-xs text-error leading-tight">{genError}</span>}
      </div>
      <textarea
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false); }}
        rows={8}
        className="w-full text-xs text-ink-body/80 bg-transparent border border-gold/30 focus:border-bordeaux outline-none rounded px-1.5 py-1 leading-relaxed resize-y"
        placeholder="説明文を入力..."
      />
      <div className="flex items-center gap-1 mt-0.5">
        {dirty && !saved && (
          <button
            onClick={handleSave}
            disabled={isPending || isGenerating}
            className="text-xs px-1.5 py-0.5 bg-gold/20 text-ink-body/70 rounded hover:bg-gold/30 disabled:opacity-40 whitespace-nowrap"
          >
            {isPending ? "…" : "保存"}
          </button>
        )}
        {saved && <span className="text-xs text-success">✓</span>}
      </div>
    </div>
  );
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

  if (done === "deleted")     return <span className="text-xs text-ink-body/60">削除済み</span>;
  if (done === "published")   return <span className="text-xs text-success font-medium">✓ 公開済み</span>;
  if (done === "unpublished") return <span className="text-xs text-warning font-medium">非公開に変更</span>;
  if (error)                  return <span className="text-xs text-error">{error}</span>;

  return (
    <div className="flex flex-col gap-1.5 items-end min-w-[80px]">
      {ev.is_published ? (
        <>
          <button
            disabled={isPending}
            onClick={handleUnpublish}
            className="text-xs px-2.5 py-1 border border-warning/40 text-warning rounded hover:bg-warning/10 disabled:opacity-40 whitespace-nowrap"
          >
            非公開に
          </button>
          <button
            disabled={isPending || isResearching}
            onClick={handleResearch}
            className="text-xs px-2.5 py-1 border border-gold/40 text-ink-body/70 rounded hover:bg-gold/10 disabled:opacity-40 whitespace-nowrap"
          >
            {isResearching ? "検索中..." : "再リサーチ"}
          </button>
        </>
      ) : (
        <>
          <button
            disabled={isPending || isResearching}
            onClick={handleResearch}
            className="text-xs px-2.5 py-1 border border-gold/40 text-ink-body/70 rounded hover:bg-gold/10 disabled:opacity-40 whitespace-nowrap"
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
  const [filter, setFilter] = useState<Filter>("published");
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [researchMsgs, setResearchMsgs] = useState<Record<string, string>>({});
  const [urlOverrides, setUrlOverrides] = useState<Record<string, string>>({});

  const duplicateIds = getDuplicateIds(events);

  // JST での「今日の開始」を算出（本日 00:00 JST）
  const todayJSTStart = (() => {
    const nowJST = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const ymd = nowJST.toISOString().slice(0, 10);
    return new Date(`${ymd}T00:00:00+09:00`);
  })();

  const isFuture = (ev: EventRecord) =>
    !ev.start_datetime || new Date(ev.start_datetime) >= todayJSTStart;

  const upcomingUnpublished = events.filter(e => isFuture(e) && !e.is_published).length;
  const upcomingPublished   = events.filter(e => isFuture(e) && e.is_published).length;
  const upcomingAll         = events.filter(e => isFuture(e)).length;
  const archiveCount        = events.filter(e => !isFuture(e)).length;

  const filtered = events.filter(ev => {
    if (filter === "unpublished") return isFuture(ev) && !ev.is_published;
    if (filter === "published")   return isFuture(ev) && ev.is_published;
    if (filter === "upcoming")    return isFuture(ev);
    if (filter === "archive")     return !isFuture(ev);
    return true;
  });

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "published",   label: "公開済み",   count: upcomingPublished },
    { key: "unpublished", label: "未公開",     count: upcomingUnpublished },
    { key: "upcoming",    label: "全件",       count: upcomingAll },
    { key: "archive",     label: "アーカイブ", count: archiveCount },
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
                : "border-gold/40 text-ink-body/70 hover:border-gold hover:text-ink-body"
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
            <tr className="border-b border-gold/30 text-xs text-ink-body/70 uppercase tracking-wider">
              <th className="text-left py-2 pr-2 font-medium w-36">画像</th>
              <th className="text-left py-2 pr-2 font-medium min-w-[180px]">イベント名 / 説明</th>
              <th className="text-left py-2 pr-2 font-medium whitespace-nowrap w-24">日時</th>
              <th className="text-left py-2 pr-2 font-medium min-w-[120px]">場所 / 主催</th>
              <th className="text-left py-2 pr-2 font-medium min-w-[100px]">ゲームタイトル</th>
              <th className="text-left py-2 pr-2 font-medium min-w-[100px] min-w-[400px]">説明</th>
              <th className="text-left py-2 pr-2 font-medium whitespace-nowrap">状態</th>
              <th className="text-right py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-ink-body/60 text-sm">
                  該当するレコードはありません
                </td>
              </tr>
            )}
            {filtered.map(ev => {
              const missing = getMissingFields(ev);
              const isDuplicate = duplicateIds.has(ev.id);
              const date    = formatDate(ev.start_datetime);
              const time       = formatTime(ev.start_datetime);
              const gameTitles = ev.event_game_titles
                .map(e => e.game_titles?.title_name)
                .filter((t): t is string => !!t);
              const researchMsg = researchMsgs[ev.id];

              return (
                <tr
                  key={ev.id}
                  className={`border-b border-gold/15 align-top ${
                    isDuplicate
                      ? "bg-red-50 hover:bg-red-100/60"
                      : ev.is_published
                      ? "hover:bg-success/5"
                      : missing.length > 0
                      ? "bg-error/[0.03] hover:bg-error/5"
                      : "hover:bg-parchment-dark/20"
                  }`}
                >
                  {/* 画像 */}
                  <td className="py-2 pr-2">
                    <ImageCell ev={ev} onOpenModal={setModalImage} />
                  </td>

                  {/* イベント名 + URL + 説明 */}
                  <td className="py-2.5 pr-2">
                    <div className="flex items-start gap-1.5 flex-wrap mb-0.5">
                      <p className="font-medium text-ink-heading leading-snug line-clamp-2 text-xs">
                        {ev.event_name}
                      </p>
                      {isDuplicate && (
                        <span className="shrink-0 text-xs font-bold text-white bg-red-600 px-1.5 py-0.5 rounded leading-tight">
                          ⚠ 重複
                        </span>
                      )}
                    </div>
                    <SeriesNameField eventId={ev.id} initialName={ev.series_name} />
                    <TicketSaleDateField eventId={ev.id} initialDate={ev.ticket_sale_start} />
                    <SourceUrlField
                      eventId={ev.id}
                      initialUrl={ev.source_url}
                      onValueChange={url => setUrlOverrides(prev => ({ ...prev, [ev.id]: url }))}
                    />
                    <OfficialUrlField eventId={ev.id} initialUrl={ev.official_url} />
                    <ManualImageUrlField eventId={ev.id} initialUrl={ev.flyer_image_url} />
                  </td>

                  {/* 日時（日付 + 時間を縦並び） */}
                  <td className="py-2.5 pr-2 whitespace-nowrap align-top">
                    {date
                      ? <span className="block text-sm text-ink-body">{date}</span>
                      : <Empty label="日付なし" />
                    }
                    {time
                      ? <span className="block text-sm text-ink-body/80 mt-0.5">{time}</span>
                      : <span className="block mt-0.5"><Empty label="時間なし" /></span>
                    }
                  </td>

                  {/* 場所 / 主催（都道府県 + 会場 + 主催者を縦並び） */}
                  <td className="py-2.5 pr-2 align-top">
                    {ev.prefecture
                      ? <span className="block text-xs text-ink-body/80">{ev.prefecture}</span>
                      : <span className="block"><Empty label="都道府県なし" /></span>
                    }
                    {ev.venue_name
                      ? <span className="block text-sm text-ink-body leading-snug mt-0.5">{ev.venue_name}</span>
                      : <span className="block mt-0.5"><Empty label="会場なし" /></span>
                    }
                    {ev.organizers?.name && (
                      <span className="block text-xs text-ink-body/70 mt-1 leading-snug">{ev.organizers.name}</span>
                    )}
                  </td>

                  {/* ゲームタイトル */}
                  <td className="py-2.5 pr-2">
                    <GameTitleField eventId={ev.id} initialTitles={gameTitles} />
                    {gameTitles.length === 0 && (() => {
                      const reason = ev.event_sources?.[0]?.raw_data?.game_music_reason;
                      return reason ? (
                        <p className="text-xs text-ink-body/70 mt-1 leading-snug max-w-[160px]" title={reason}>
                          理由: {reason}
                        </p>
                      ) : null;
                    })()}
                  </td>

                  {/* 説明 */}
                  <td className="py-2.5 pr-2 align-top min-w-[400px]">
                    <DescriptionCell eventId={ev.id} initialDescription={ev.description} />
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
                      <div className="text-xs text-ink-body/70 text-right mb-1 leading-tight max-w-[100px] ml-auto">
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
