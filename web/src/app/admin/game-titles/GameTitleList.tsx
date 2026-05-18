"use client";

import { useState, useTransition, useEffect } from "react";
import { saveGameTitle, deleteGameTitle, fetchAmazonByAsin, saveAmazonItem } from "./actions";
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
  event_count: number;
};

function CoverImage({ url, fallbackUrl, alt }: { url: string | null; fallbackUrl?: string | null; alt: string }) {
  const [primaryErrored, setPrimaryErrored] = useState(false);
  const [fallbackErrored, setFallbackErrored] = useState(false);

  useEffect(() => { setPrimaryErrored(false); setFallbackErrored(false); }, [url]);

  let effectiveUrl: string | null;
  if (!primaryErrored) {
    effectiveUrl = url;
  } else if (!fallbackErrored && fallbackUrl) {
    effectiveUrl = fallbackUrl;
  } else {
    effectiveUrl = null;
  }

  const handleError = () => {
    if (!primaryErrored) setPrimaryErrored(true);
    else setFallbackErrored(true);
  };

  if (!effectiveUrl) {
    return (
      <div className="w-32 h-40 bg-parchment-dark border border-gold/20 rounded flex items-center justify-center shrink-0">
        <span className="text-ink-body/30 text-xs">No image</span>
      </div>
    );
  }
  return (
    <div className="w-32 h-40 shrink-0 rounded overflow-hidden border border-gold/20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={effectiveUrl} alt={alt} className="w-full h-full object-cover" onError={handleError} />
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

function KeyVisualUrlField({ id, initialUrl }: { id: string; initialUrl: string | null }) {
  const [value, setValue] = useState(initialUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const isDirty = value !== (initialUrl ?? "");

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-ink-body/40 shrink-0">画像URL:</span>
      <input
        className="text-xs border-b border-gold/40 bg-transparent flex-1 min-w-0 py-0.5 focus:outline-none focus:border-bordeaux/60 text-ink-body/70"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && isDirty) {
            startTransition(async () => { await saveGameTitle(id, { key_visual_url: value }); setSaved(true); });
          }
        }}
        placeholder="画像URLを貼り付け..."
      />
      {isDirty && !saved && (
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await saveGameTitle(id, { key_visual_url: value }); setSaved(true); })}
          className="shrink-0 text-bordeaux/60 hover:text-bordeaux underline underline-offset-2 disabled:opacity-50"
        >
          保存
        </button>
      )}
      {saved && <span className="text-ink-body/40 shrink-0">✓</span>}
    </div>
  );
}

function AsinInputPanel({ id, existingAsin }: { id: string; existingAsin: string | null }) {
  const [input, setInput] = useState(existingAsin ?? "");
  const [preview, setPreview] = useState<{ asin: string; imageUrl: string | null; affiliateUrl: string } | null>(null);
  const [imgError, setImgError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function handleConfirm() {
    setError(null);
    setPreview(null);
    setImgError(false);
    const res = { ok: false, asin: "", imageUrl: null as string | null, affiliateUrl: "" };
    const trimmed = input.trim();
    const asinMatch = trimmed.match(/\/dp\/([A-Z0-9]{10})/i) ?? (/^[A-Z0-9]{10}$/i.test(trimmed) ? [null, trimmed] : null);
    if (!asinMatch) { setError("Amazon URL または ASIN（10文字）を入力してください"); return; }
    const asin = asinMatch[1].toUpperCase();
    setPreview({
      asin,
      imageUrl: `https://m.media-amazon.com/images/P/${asin}.09.LZZZZZZZ.jpg`,
      affiliateUrl: `https://www.amazon.co.jp/dp/${asin}?tag=k0642-22`,
    });
    void res;
  }

  function handleSave() {
    if (!preview) return;
    const item: AmazonItem = { asin: preview.asin, title: "", imageUrl: null, affiliateUrl: preview.affiliateUrl };
    startSave(async () => {
      await saveAmazonItem(id, item);
      setPreview(null);
      setInput(preview.asin);
    });
  }

  return (
    <div className="pt-1 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-body/40 shrink-0">Amazon:</span>
        <input
          className="text-xs border border-gold/40 rounded px-2 py-0.5 bg-white flex-1 min-w-0 focus:outline-none focus:border-bordeaux/60"
          value={input}
          onChange={(e) => { setInput(e.target.value); setPreview(null); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
          placeholder="SiteStripe の URL または ASIN を貼り付け"
        />
        <button
          onClick={handleConfirm}
          disabled={input.trim().length === 0}
          className="shrink-0 text-xs text-bordeaux/70 hover:text-bordeaux underline underline-offset-2 disabled:opacity-40"
        >
          確認
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {preview && (
        <div className="flex items-start gap-4 bg-white border border-gold/20 rounded px-4 py-3">
          {!imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.imageUrl ?? ""}
              alt={preview.asin}
              className="w-40 h-56 object-cover rounded shrink-0"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-40 h-56 bg-parchment-dark border border-gold/20 rounded flex items-center justify-center shrink-0">
              <span className="text-ink-body/30 text-xs">No image</span>
            </div>
          )}
          <div className="flex flex-col justify-between h-56 min-w-0">
            <div className="space-y-1">
              <p className="text-xs text-ink-body/40">ASIN: {preview.asin}</p>
              <a
                href={preview.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-bordeaux/60 hover:text-bordeaux underline underline-offset-2"
              >
                Amazon で確認 →
              </a>
            </div>
            <button
              disabled={saving}
              onClick={handleSave}
              className="self-start text-xs bg-bordeaux text-white px-3 py-1.5 rounded hover:bg-bordeaux/80 disabled:opacity-40"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function GameTitleList({ titles }: { titles: GameTitle[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {titles.map((t) => {
        const displayImage = t.amazon_asin
          ? `/api/amazon-image?asin=${t.amazon_asin}`
          : t.key_visual_url ?? t.igdb_cover_url;
        const fallbackImage = t.amazon_asin ? (t.key_visual_url ?? t.igdb_cover_url) : null;
        return (
          <div
            key={t.id}
            className="flex items-start gap-4 bg-parchment rounded-md border border-gold/30 px-4 py-3"
          >
            <CoverImage url={displayImage} fallbackUrl={fallbackImage} alt={t.title_name} />

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-heading text-ink-heading text-sm font-semibold">
                  {t.title_name}
                </span>
                {t.english_name && t.english_name !== t.title_name && (
                  <span className="text-xs text-ink-body/50">{t.english_name}</span>
                )}
                <a
                  href={`https://www.amazon.co.jp/s?k=${encodeURIComponent(t.title_name + " サウンドトラック")}&tag=k0642-22`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-ink-body/30 hover:text-bordeaux border border-transparent hover:border-bordeaux/20 px-2 py-0.5 rounded transition-colors"
                >
                  Amazon で検索 →
                </a>
                <DeleteButton id={t.id} name={t.title_name} />
              </div>

              <EditableField
                label="シリーズ"
                value={t.series_name}
                onSave={(v) => saveGameTitle(t.id, { series_name: v }).then(() => {})}
              />
              <KeyVisualUrlField id={t.id} initialUrl={t.key_visual_url} />

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

              <div className="text-xs pt-0.5">
                <span className="text-ink-body/40">イベント紐付け: </span>
                <span className={t.event_count === 0 ? "text-red-500 font-semibold" : "text-ink-body/60"}>
                  {t.event_count} 件
                </span>
              </div>

              <AsinInputPanel id={t.id} existingAsin={t.amazon_asin} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
