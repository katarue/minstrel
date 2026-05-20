"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateMusicCurationStatus,
  updateMusicCurationNotes,
  deleteMusicCuration,
} from "../actions";
import type { MusicCuration, MusicCurationStatus } from "../types";

const STATUS_ACTIONS: { status: MusicCurationStatus; label: string; cls: string }[] = [
  { status: "accepted", label: "採用", cls: "border-success/40 text-success/70 hover:bg-success/10 hover:text-success" },
  { status: "pending",  label: "保留", cls: "border-warning/40 text-warning/70 hover:bg-warning/10 hover:text-warning" },
  { status: "rejected", label: "却下", cls: "border-error/40 text-error/70 hover:bg-error/10 hover:text-error" },
  { status: "unchecked",label: "未確認に戻す", cls: "border-gold/30 text-ink-body/60 hover:border-bordeaux hover:text-bordeaux" },
];

export function MusicCurationDetailClient({ track }: { track: MusicCuration }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(track.notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStatus = (status: MusicCurationStatus) => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await updateMusicCurationStatus(track.id, status);
      if (!res.ok) setErrorMsg(res.message ?? "ステータス更新に失敗しました");
      else router.refresh();
    });
  };

  const handleSaveNotes = () => {
    setErrorMsg(null);
    setNotesSaved(false);
    startTransition(async () => {
      const res = await updateMusicCurationNotes(track.id, notes);
      if (!res.ok) setErrorMsg(res.message ?? "メモの保存に失敗しました");
      else setNotesSaved(true);
    });
  };

  const handleDelete = () => {
    if (!confirm(`「${track.track_name}」を削除してもよいですか？この操作は元に戻せません。`)) return;
    startTransition(async () => {
      const res = await deleteMusicCuration(track.id);
      if (!res.ok) setErrorMsg(res.message ?? "削除に失敗しました");
      else router.push("/admin/music_curation");
    });
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <p className="text-sm text-error bg-error/10 px-4 py-2 rounded">{errorMsg}</p>
      )}

      {/* ステータス変更 */}
      <div className="bg-parchment rounded-md border border-gold/30 px-5 py-4">
        <h2 className="text-xs font-semibold text-ink-body/50 uppercase tracking-widest mb-3">ステータス変更</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_ACTIONS.filter((a) => a.status !== track.status).map((a) => (
            <button
              key={a.status}
              onClick={() => handleStatus(a.status)}
              disabled={isPending}
              className={`text-sm px-3 py-1.5 rounded border transition-colors disabled:opacity-40 ${a.cls}`}
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-sm px-3 py-1.5 rounded border border-error/30 text-error/70 hover:bg-error/10 hover:text-error transition-colors disabled:opacity-40 ml-auto"
          >
            削除
          </button>
        </div>
      </div>

      {/* メモ */}
      <div className="bg-parchment rounded-md border border-gold/30 px-5 py-4">
        <h2 className="text-xs font-semibold text-ink-body/50 uppercase tracking-widest mb-3">メモ</h2>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
          rows={4}
          placeholder="採用理由、却下理由、補足情報など..."
          className="w-full text-sm font-body bg-transparent border border-gold/30 rounded px-3 py-2 text-ink-body placeholder:text-ink-body/30 focus:outline-none focus:border-bordeaux/60 resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          {notesSaved ? (
            <span className="text-xs text-success">保存しました</span>
          ) : (
            <span />
          )}
          <button
            onClick={handleSaveNotes}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded bg-bordeaux text-parchment hover:bg-bordeaux/80 transition-colors disabled:opacity-40"
          >
            メモを保存
          </button>
        </div>
      </div>
    </div>
  );
}
