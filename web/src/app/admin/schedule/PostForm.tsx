"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScheduledPostCategory } from "./types";
import { CATEGORY_LABELS } from "./types";
import type { PostFormValues } from "./actions";

const CATEGORIES: ScheduledPostCategory[] = [
  "release",
  "new_music",
  "ticket",
  "youtube",
  "other",
];

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  initialValues?: {
    category?: ScheduledPostCategory;
    scheduled_at?: string;
    body?: string;
    image_urls?: string[];
  };
  onSubmit: (values: PostFormValues) => Promise<{ ok: boolean; message?: string }>;
  submitLabel: string;
};

export function PostForm({ initialValues, onSubmit, submitLabel }: Props) {
  const [category, setCategory] = useState<ScheduledPostCategory>(
    initialValues?.category ?? "other"
  );
  const [scheduledAt, setScheduledAt] = useState(
    initialValues?.scheduled_at ? toLocalDatetime(initialValues.scheduled_at) : ""
  );
  const [body, setBody] = useState(initialValues?.body ?? "");
  const [imageUrls, setImageUrls] = useState<string[]>(() => {
    const base = initialValues?.image_urls ?? [];
    return [...base, "", "", "", ""].slice(0, 4);
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const charCount = body.length;
  const isOver = charCount > 280;

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const values: PostFormValues = {
        category,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : "",
        body,
        image_urls: imageUrls.filter(Boolean),
      };
      const res = await onSubmit(values);
      if (res && !res.ok) setError(res.message ?? "エラーが発生しました");
    });
  };

  const updateImageUrl = (i: number, val: string) => {
    const next = [...imageUrls];
    next[i] = val;
    setImageUrls(next);
  };

  const validImageUrls = imageUrls.filter(Boolean);

  return (
    <div className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-error/10 text-error text-sm px-4 py-2.5 rounded border border-error/20">
          {error}
        </div>
      )}

      {/* カテゴリ */}
      <div>
        <label className="block text-xs text-ink-body/70 uppercase tracking-wide mb-1.5">
          カテゴリ
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ScheduledPostCategory)}
          className="text-sm bg-parchment border border-gold/40 rounded px-3 py-1.5 text-ink-body focus:border-bordeaux outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {/* 投稿日時 */}
      <div>
        <label className="block text-xs text-ink-body/70 uppercase tracking-wide mb-1.5">
          投稿日時 <span className="text-error">*</span>
        </label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="text-sm bg-parchment border border-gold/40 rounded px-3 py-1.5 text-ink-body focus:border-bordeaux outline-none"
        />
        <p className="text-xs text-ink-body/40 mt-1">
          ⚠️ 月曜・金曜 08:55〜09:15 は週次自動投稿との競合を避けるため、この時間帯の予約はお控えください
        </p>
      </div>

      {/* 本文 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-ink-body/70 uppercase tracking-wide">
            本文 <span className="text-error">*</span>
          </label>
          <span
            className={`text-xs font-mono tabular-nums ${isOver ? "text-error font-bold" : "text-ink-body/50"}`}
          >
            {charCount} / 280
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="投稿する本文を入力してください..."
          className={`w-full text-sm bg-parchment border rounded px-3 py-2 text-ink-body focus:outline-none resize-y ${
            isOver ? "border-error" : "border-gold/40 focus:border-bordeaux"
          }`}
        />
      </div>

      {/* 画像URL */}
      <div>
        <label className="block text-xs text-ink-body/70 uppercase tracking-wide mb-1.5">
          画像URL（任意、最大4件）
        </label>
        <div className="space-y-2">
          {imageUrls.map((url, i) => (
            <input
              key={i}
              type="url"
              value={url}
              onChange={(e) => updateImageUrl(i, e.target.value)}
              placeholder={`画像URL ${i + 1}（https://...）`}
              className="w-full text-sm bg-parchment border border-gold/40 rounded px-3 py-1.5 text-ink-body focus:border-bordeaux outline-none"
            />
          ))}
        </div>
      </div>

      {/* プレビュー */}
      {body && (
        <div>
          <p className="text-xs text-ink-body/70 uppercase tracking-wide mb-2">プレビュー</p>
          <div className="border border-gold/30 rounded-xl p-4 bg-white max-w-sm shadow-sm">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-full bg-bordeaux/20 flex items-center justify-center shrink-0">
                <span className="text-bordeaux text-sm font-bold">M</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">Minstrel</p>
                <p className="text-xs text-gray-500">@minstrel_live</p>
              </div>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
              {body}
            </p>
            {validImageUrls.length > 0 && (
              <div
                className={`mt-3 grid gap-1 rounded-xl overflow-hidden ${
                  validImageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"
                }`}
              >
                {validImageUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="w-full object-cover aspect-video bg-gray-100"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* アクション */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || isOver}
          className="font-body text-sm bg-bordeaux text-parchment hover:bg-bordeaux/80 transition-colors rounded px-4 py-2 disabled:opacity-40"
        >
          {isPending ? "処理中..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="font-body text-sm text-ink-body/60 hover:text-bordeaux transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
