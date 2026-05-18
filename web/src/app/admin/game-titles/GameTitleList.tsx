"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { saveGameTitle } from "./actions";

export type GameTitle = {
  id: string;
  title_name: string;
  english_name: string | null;
  series_name: string | null;
  publisher: string | null;
  igdb_cover_url: string | null;
  key_visual_url: string | null;
};

function CoverImage({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return (
      <div className="w-16 h-20 bg-parchment-dark border border-gold/20 rounded flex items-center justify-center shrink-0">
        <span className="text-ink-body/30 text-xs">No image</span>
      </div>
    );
  }
  return (
    <div className="w-16 h-20 relative shrink-0 rounded overflow-hidden border border-gold/20">
      <Image src={url} alt={alt} fill className="object-cover" unoptimized />
    </div>
  );
}

function EditableField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-xs text-ink-body/60 min-w-0">
        <span className="text-ink-body/40 shrink-0">{label}:</span>
        <span className="truncate">{value || <span className="text-ink-body/30 italic">未設定</span>}</span>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-bordeaux/60 hover:text-bordeaux text-xs underline underline-offset-2"
        >
          編集
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-body/40 shrink-0">{label}:</span>
      <input
        className="text-xs border border-gold/40 rounded px-2 py-0.5 bg-white flex-1 min-w-0 focus:outline-none focus:border-bordeaux/60"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      <button
        disabled={pending}
        onClick={() => startTransition(async () => { await onSave(draft); setEditing(false); })}
        className="shrink-0 text-xs bg-bordeaux text-white px-2 py-0.5 rounded hover:bg-bordeaux/80 disabled:opacity-50"
      >
        保存
      </button>
      <button
        onClick={() => { setDraft(value ?? ""); setEditing(false); }}
        className="shrink-0 text-xs text-ink-body/40 hover:text-ink-body"
      >
        取消
      </button>
    </div>
  );
}

export function GameTitleList({ titles }: { titles: GameTitle[] }) {
  return (
    <div className="space-y-2">
      {titles.map((t) => (
        <div
          key={t.id}
          className="flex items-start gap-4 bg-parchment rounded-md border border-gold/30 px-4 py-3"
        >
          <CoverImage url={t.igdb_cover_url ?? t.key_visual_url} alt={t.title_name} />

          <div className="flex-1 min-w-0 space-y-1.5">
            <div>
              <span className="font-heading text-ink-heading text-sm font-semibold">
                {t.title_name}
              </span>
              {t.english_name && t.english_name !== t.title_name && (
                <span className="ml-2 text-xs text-ink-body/50">{t.english_name}</span>
              )}
            </div>

            <EditableField
              label="シリーズ"
              value={t.series_name}
              onSave={(v) => saveGameTitle(t.id, { series_name: v }).then(() => {})}
            />
            <EditableField
              label="パブリッシャー"
              value={t.publisher}
              onSave={(v) => saveGameTitle(t.id, { publisher: v }).then(() => {})}
            />
            <EditableField
              label="カスタム画像URL"
              value={t.key_visual_url}
              onSave={(v) => saveGameTitle(t.id, { key_visual_url: v }).then(() => {})}
            />

            <div className="text-xs text-ink-body/30 pt-0.5">
              {t.igdb_cover_url ? "✓ IGDB画像あり" : "△ IGDB画像なし"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
