"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { submitContact } from "./actions";

export default function ContactForm() {
  const t = useTranslations("contact");
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

  const inputClass = "font-body bg-parchment border border-gold/50 rounded px-3 py-2 text-ink-body text-base focus:outline-none focus:border-bordeaux transition-colors";

  if (result?.ok) {
    return (
      <div className="bg-parchment-dark rounded-md p-6 text-center flex flex-col gap-3"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}>
        <p className="font-heading text-ink-heading text-lg font-semibold">{t("successTitle")}</p>
        <p className="font-body text-ink-body text-sm">{t("successBody")}</p>
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
          {t("fieldName")} <span className="text-error">*</span>
        </label>
        <input id="name" name="name" type="text" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-body text-ink-body/70 text-sm" htmlFor="email">
          {t("fieldEmail")} <span className="text-error">*</span>
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-body text-ink-body/70 text-sm" htmlFor="type">
          {t("fieldType")} <span className="text-error">*</span>
        </label>
        <select id="type" name="type" required className={inputClass + " cursor-pointer"}>
          <option value="">{t("typeSelect")}</option>
          <option value="delete">{t("typeDelete")}</option>
          <option value="correction">{t("typeCorrection")}</option>
          <option value="event_add">{t("typeEventAdd")}</option>
          <option value="other">{t("typeOther")}</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="font-body text-ink-body/70 text-sm" htmlFor="message">
          {t("fieldMessage")} <span className="text-error">*</span>
        </label>
        <textarea id="message" name="message" required rows={6} className={inputClass + " resize-none"} />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer bg-bordeaux text-parchment hover:bg-bordeaux/80 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-base"
      >
        {isPending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
