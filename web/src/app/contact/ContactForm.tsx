"use client";

import { useState, useTransition } from "react";
import { submitContact } from "./actions";

const CONTACT_TYPES = [
  { value: "delete", label: "掲載情報の削除依頼" },
  { value: "correction", label: "掲載情報の修正依頼" },
  { value: "event_add", label: "イベント情報の掲載依頼" },
  { value: "other", label: "その他" },
];

export default function ContactForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitContact(formData);
      setResult(res);
    });
  }

  if (result?.ok) {
    return (
      <div className="bg-parchment-dark rounded-md p-6 text-center flex flex-col gap-3"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}>
        <p className="font-heading text-ink-heading text-lg font-semibold">送信が完了しました</p>
        <p className="font-body text-ink-body text-sm">
          お問い合わせありがとうございます。内容を確認のうえ、必要に応じてご連絡いたします。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {result && !result.ok && (
        <p className="font-body text-error text-sm">{result.error}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="font-body text-ink-body/70 text-sm" htmlFor="name">
          お名前 <span className="text-error">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="font-body bg-parchment border border-gold/50 rounded px-3 py-2 text-ink-body text-base focus:outline-none focus:border-bordeaux transition-colors"
          placeholder="山田 太郎"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-body text-ink-body/70 text-sm" htmlFor="email">
          メールアドレス <span className="text-error">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="font-body bg-parchment border border-gold/50 rounded px-3 py-2 text-ink-body text-base focus:outline-none focus:border-bordeaux transition-colors"
          placeholder="example@mail.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-body text-ink-body/70 text-sm" htmlFor="type">
          お問い合わせ種別 <span className="text-error">*</span>
        </label>
        <select
          id="type"
          name="type"
          required
          className="font-body bg-parchment border border-gold/50 rounded px-3 py-2 text-ink-body text-base focus:outline-none focus:border-bordeaux transition-colors"
        >
          <option value="">選択してください</option>
          {CONTACT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-body text-ink-body/70 text-sm" htmlFor="message">
          お問い合わせ内容 <span className="text-error">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className="font-body bg-parchment border border-gold/50 rounded px-3 py-2 text-ink-body text-base focus:outline-none focus:border-bordeaux transition-colors resize-none"
          placeholder="お問い合わせ内容をご記入ください。&#10;&#10;削除・修正依頼の場合は、対象のイベント名と理由をお書きください。"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer bg-bordeaux text-parchment hover:bg-bordeaux/80 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-base"
      >
        {isPending ? "送信中..." : "送信する"}
      </button>
    </form>
  );
}
