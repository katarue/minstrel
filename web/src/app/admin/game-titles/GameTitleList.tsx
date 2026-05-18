"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { saveGameTitle, deleteGameTitle, searchAmazonForTitle, saveAmazonItem } from "./actions";
import type { AmazonItem } from "@/lib/amazon-pa";

export type GameTitle = {
  id: string;
  title_name: string;
  english_name: string | null;
  series_name: string | null;
  publisher: string | null;
  igdb_cover_url: string | null;
  key_visual_url: string | null;
  amazon_asin: string | null;
  amazon_image_url: string | null;
  amazon_affiliate_url: string | null;
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

function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`「${name}」を削除しますか？`)) return;
        startTransition(async () => { await deleteGameTitle(id); });
      }}
      className="shrink-0 text-xs text-ink-body/30 hover:text-red-500 border border-transparent hover:border-red-200 px-2 py-0.5 rounded transition-colors disabled:opacity-40"
    >
      削除
    </button>
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

function AmazonSearchPanel({ id, titleName }: { id: string; titleName: string }) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AmazonItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  function handleSearch() {
    setError(null);
    setResults([]);
    setOpen(true);
    startSearch(async () => {
      const res = await searchAmazonForTitle(titleName);
      if (!res.ok) { setError(res.message ?? "エラー"); return; }
      setResults(res.items ?? []);
    });
  }

  function handleSelect(item: AmazonItem) {
    startSave(async () => {
      await saveAmazonItem(id, item);
      setOpen(false);
      setResults([]);
    });
  }

  return (
    <div className="pt-1">
      <button
        onClick={handleSearch}
        disabled={searching}
        className="text-xs text-bordeaux/70 hover:text-bordeaux underline underline-offset-2 disabled:opacity-40"
      >
        {searching ? "検索中…" : "Amazon サウンドトラック検索"}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {!searching && results.length === 0 && !error && (
            <p className="text-xs text-ink-body/40">結果なし</p>
          )}
          {results.map((item) => (
            <div
              key={item.asin}
              className="flex items-center gap-3 bg-white border border-gold/20 rounded px-3 py-2"
            >
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.title} className="w-10 h-14 object-cover rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-heading line-clamp-2">{item.title}</p>
                <p className="text-xs text-ink-body/40 mt-0.5">ASIN: {item.asin}</p>
              </div>
              <button
                disabled={saving}
                onClick={() => handleSelect(item)}
                className="shrink-0 text-xs bg-bordeaux text-white px-2 py-1 rounded hover:bg-bordeaux/80 disabled:opacity-40"
              >
                選択
              </button>
            </div>
          ))}
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-ink-body/40 hover:text-ink-body"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}

export function GameTitleList({ titles }: { titles: GameTitle[] }) {
  return (
    <div className="space-y-2">
      {titles.map((t) => {
        const displayImage = t.amazon_image_url ?? t.igdb_cover_url ?? t.key_visual_url;
        return (
          <div
            key={t.id}
            className="flex items-start gap-4 bg-parchment rounded-md border border-gold/30 px-4 py-3"
          >
            <CoverImage url={displayImage} alt={t.title_name} />

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-heading text-ink-heading text-sm font-semibold">
                  {t.title_name}
                </span>
                {t.english_name && t.english_name !== t.title_name && (
                  <span className="text-xs text-ink-body/50">{t.english_name}</span>
                )}
                <DeleteButton id={t.id} name={t.title_name} />
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

              <div className="flex items-center gap-3 text-xs pt-0.5">
                {t.amazon_asin ? (
                  <>
                    <span className="text-green-600">✓ Amazon連携済み（{t.amazon_asin}）</span>
                    <a
                      href={t.amazon_affiliate_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-bordeaux/60 hover:text-bordeaux underline underline-offset-2"
                    >
                      リンク確認
                    </a>
                  </>
                ) : (
                  <span className="text-ink-body/30">
                    {t.igdb_cover_url ? "✓ IGDB画像あり" : "△ 画像なし"}
                  </span>
                )}
              </div>

              <AmazonSearchPanel id={t.id} titleName={t.title_name} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
