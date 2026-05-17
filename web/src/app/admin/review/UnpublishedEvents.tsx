"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { publishEvent, deleteEvent } from "./publish-actions";
import { reresearchEvent } from "./research-actions";

type UnpublishedEvent = {
  id: string;
  event_name: string;
  start_datetime: string | null;
  venue_name: string | null;
  prefecture: string | null;
  source_url: string | null;
  flyer_image_url: string | null;
  key_visual_url: string | null;
  organizers: { name: string } | null;
  event_game_titles: Array<{ game_titles: { title_name: string } | null }>;
};

function formatDate(dt: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return "—";
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}/${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
}

function formatTime(dt: string | null): string | null {
  if (!dt) return null;
  const d = new Date(dt);
  if (isNaN(d.getTime())) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const h = jst.getUTCHours();
  const m = jst.getUTCMinutes();
  if (h === 0 && m === 0) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 必須項目の充足チェック — 単一責任の判定関数
function getMissingFields(ev: UnpublishedEvent): string[] {
  const missing: string[] = [];
  if (!ev.flyer_image_url && !ev.key_visual_url) missing.push("フライヤー/画像");
  if (!ev.organizers?.name)                       missing.push("主催者");
  if (!ev.event_game_titles.length)               missing.push("ゲームタイトル");
  if (!ev.venue_name)                             missing.push("会場名");
  if (!ev.prefecture)                             missing.push("都道府県");
  if (!ev.start_datetime)                         missing.push("開催日");
  else if (!formatTime(ev.start_datetime))        missing.push("開催時間");
  if (!ev.source_url)                             missing.push("ソースURL");
  return missing;
}

function Cell({ value, label }: { value: string | null | undefined; label: string }) {
  if (value) return <span className="text-ink-body/80">{value}</span>;
  return <span className="text-error text-xs font-medium">✗ {label}なし</span>;
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

function ActionButtons({ ev }: { ev: UnpublishedEvent }) {
  const [publishDone, setPublishDone] = useState(false);
  const [deleteDone, setDeleteDone] = useState(false);
  const [error, setError] = useState("");
  const [researchMsg, setResearchMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isResearching, startResearch] = useTransition();

  const missing = getMissingFields(ev);
  const canPublish = missing.length === 0;

  const handlePublish = () => {
    startTransition(async () => {
      const res = await publishEvent(ev.id);
      if (res.ok) setPublishDone(true);
      else setError(res.message ?? "エラー");
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteEvent(ev.id);
      if (res.ok) setDeleteDone(true);
      else setError(res.message ?? "エラー");
    });
  };

  const handleResearch = () => {
    setResearchMsg("");
    startResearch(async () => {
      const res = await reresearchEvent(ev.id);
      setResearchMsg(res.message ?? (res.ok ? "完了" : "エラー"));
    });
  };

  if (publishDone) return <span className="text-xs text-success font-medium">✓ 公開済み</span>;
  if (deleteDone)  return <span className="text-xs text-ink-body/60">削除済み</span>;
  if (error)       return <span className="text-xs text-error">{error}</span>;

  return (
    <div className="flex flex-col gap-1.5 items-end">
      {researchMsg && (
        <span className="text-xs text-ink-body/70 text-right leading-tight">{researchMsg}</span>
      )}
      {!canPublish && (
        <button
          disabled={isPending || isResearching}
          onClick={handleResearch}
          className="text-xs px-3 py-1 border border-gold/40 text-ink-body/70 rounded hover:bg-gold/10 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {isResearching ? "検索中..." : "再リサーチ"}
        </button>
      )}
      <button
        disabled={isPending || isResearching || !canPublish}
        onClick={handlePublish}
        title={!canPublish ? `不足: ${missing.join("、")}` : ""}
        className="text-xs px-3 py-1 bg-bordeaux text-parchment rounded hover:bg-bordeaux/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        {isPending ? "..." : "公開する"}
      </button>
      <button
        disabled={isPending || isResearching}
        onClick={handleDelete}
        className="text-xs px-3 py-1 border border-error/30 text-error/70 rounded hover:bg-error/10 hover:text-error disabled:opacity-40 transition-colors whitespace-nowrap"
      >
        削除する
      </button>
    </div>
  );
}

export function UnpublishedEvents({ events }: { events: UnpublishedEvent[] }) {
  const [modalImage, setModalImage] = useState<string | null>(null);

  if (events.length === 0) {
    return <p className="text-sm text-ink-body/60 py-4 text-center">未公開イベントはありません</p>;
  }

  const readyCount   = events.filter(ev => getMissingFields(ev).length === 0).length;
  const pendingCount = events.length - readyCount;

  return (
    <div className="space-y-2">
      {/* サマリー */}
      <div className="flex gap-4 text-xs text-ink-body/70">
        <span>全 {events.length} 件</span>
        <span className="text-success font-medium">公開可 {readyCount} 件</span>
        {pendingCount > 0 && (
          <span className="text-warning font-medium">情報不足 {pendingCount} 件</span>
        )}
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gold/30 text-xs text-ink-body/70 uppercase tracking-wider">
              <th className="text-left py-2 pr-3 font-medium w-20">画像</th>
              <th className="text-left py-2 pr-3 font-medium">イベント名</th>
              <th className="text-left py-2 pr-3 font-medium whitespace-nowrap">開催日時</th>
              <th className="text-left py-2 pr-3 font-medium whitespace-nowrap">会場 / 都道府県</th>
              <th className="text-left py-2 pr-3 font-medium whitespace-nowrap">主催者</th>
              <th className="text-left py-2 pr-3 font-medium whitespace-nowrap">ゲームタイトル</th>
              <th className="py-2 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const missing   = getMissingFields(ev);
              const imageUrl  = ev.flyer_image_url ?? ev.key_visual_url;
              const gameTitles = ev.event_game_titles
                .map(egt => egt.game_titles?.title_name)
                .filter((t): t is string => !!t);
              const time = formatTime(ev.start_datetime);

              return (
                <tr
                  key={ev.id}
                  className={`border-b border-gold/15 transition-colors ${
                    missing.length > 0 ? "bg-error/3" : "hover:bg-parchment-dark/20"
                  }`}
                >
                  {/* 画像 */}
                  <td className="py-2.5 pr-3">
                    {imageUrl ? (
                      <div
                        className="relative w-20 h-20 rounded overflow-hidden bg-parchment-dark shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setModalImage(imageUrl)}
                      >
                        <Image src={imageUrl} alt="" fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded bg-error/10 flex items-center justify-center shrink-0">
                        <span className="text-error text-xs">✗</span>
                      </div>
                    )}
                  </td>

                  {/* イベント名 + ソースURL */}
                  <td className="py-2.5 pr-3 max-w-[200px]">
                    <p className="font-medium text-ink-heading leading-snug line-clamp-2">{ev.event_name}</p>
                    {ev.source_url ? (
                      <a
                        href={ev.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-bordeaux/60 hover:underline truncate block"
                      >
                        {ev.source_url}
                      </a>
                    ) : (
                      <span className="text-xs text-error">✗ ソースURLなし</span>
                    )}
                  </td>

                  {/* 開催日時 */}
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <Cell value={formatDate(ev.start_datetime)} label="開催日" />
                    {ev.start_datetime && (
                      time
                        ? <span className="block text-ink-body/80 text-xs mt-0.5">{time}</span>
                        : <span className="block text-error text-xs font-medium mt-0.5">✗ 時間なし</span>
                    )}
                  </td>

                  {/* 会場 / 都道府県 */}
                  <td className="py-2.5 pr-3">
                    {ev.venue_name || ev.prefecture ? (
                      <span className="text-ink-body/80">
                        {[ev.venue_name, ev.prefecture].filter(Boolean).join(" / ")}
                      </span>
                    ) : (
                      <span className="text-error text-xs font-medium">✗ 会場・都道府県なし</span>
                    )}
                  </td>

                  {/* 主催者 */}
                  <td className="py-2.5 pr-3">
                    <Cell value={ev.organizers?.name} label="主催者" />
                  </td>

                  {/* ゲームタイトル */}
                  <td className="py-2.5 pr-3">
                    {gameTitles.length > 0 ? (
                      <span className="text-ink-body/80">
                        {gameTitles[0]}
                        {gameTitles.length > 1 && (
                          <span className="text-ink-body/70 ml-1">+{gameTitles.length - 1}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-error text-xs font-medium">✗ タイトルなし</span>
                    )}
                  </td>

                  {/* 操作 */}
                  <td className="py-2.5 text-right align-middle">
                    <ActionButtons ev={ev} />
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
