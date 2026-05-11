"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { submitEvent } from "./actions";

export default function SubmitForm() {
  const t = useTranslations("submit");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitEvent(formData);
      setResult(res);
    });
  }

  const inputClass =
    "font-body bg-parchment border border-gold/50 rounded px-3 py-2 text-ink-body text-base focus:outline-none focus:border-bordeaux transition-colors w-full";
  const labelClass = "font-body text-ink-body/70 text-sm";

  if (result?.ok) {
    return (
      <div className="bg-parchment-dark rounded-md p-8 text-center flex flex-col gap-3"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}>
        <p className="font-heading text-ink-heading text-lg font-semibold">{t("successTitle")}</p>
        <p className="font-body text-ink-body text-sm">{t("successBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* honeypot */}
      <input type="text" name="website" className="hidden" tabIndex={-1} aria-hidden="true" />

      {result && !result.ok && (
        <p className="font-body text-error text-sm">{result.error}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="event_name">
          {t("fieldEventName")} <span className="text-error">*</span>
        </label>
        <input id="event_name" name="event_name" type="text" required className={inputClass}
          placeholder={t("fieldEventNamePlaceholder")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="date">
            {t("fieldDate")} <span className="text-error">*</span>
          </label>
          <input id="date" name="date" type="date" required className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="time">
            {t("fieldTime")}
          </label>
          <input id="time" name="time" type="time" className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="venue">
          {t("fieldVenue")} <span className="text-error">*</span>
        </label>
        <input id="venue" name="venue" type="text" required className={inputClass}
          placeholder={t("fieldVenuePlaceholder")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="prefecture">
          {t("fieldPrefecture")} <span className="text-error">*</span>
        </label>
        <input id="prefecture" name="prefecture" type="text" required className={inputClass}
          placeholder={t("fieldPrefecturePlaceholder")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="organizer_name">
          {t("fieldOrganizer")} <span className="text-error">*</span>
        </label>
        <input id="organizer_name" name="organizer_name" type="text" required className={inputClass}
          placeholder={t("fieldOrganizerPlaceholder")} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="game_titles">
          {t("fieldGameTitles")}
        </label>
        <input id="game_titles" name="game_titles" type="text" className={inputClass}
          placeholder={t("fieldGameTitlesPlaceholder")} />
        <p className="text-xs text-ink-body/50">{t("fieldGameTitlesHint")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="ticket_url">
          {t("fieldTicketUrl")}
        </label>
        <input id="ticket_url" name="ticket_url" type="url" className={inputClass}
          placeholder="https://" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="official_url">
          {t("fieldOfficialUrl")}
        </label>
        <input id="official_url" name="official_url" type="url" className={inputClass}
          placeholder="https://" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="notes">
          {t("fieldNotes")}
        </label>
        <textarea id="notes" name="notes" rows={4} className={inputClass + " resize-none"}
          placeholder={t("fieldNotesPlaceholder")} />
      </div>

      <hr className="border-gold/30" />

      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="email">
          {t("fieldEmail")} <span className="text-error">*</span>
        </label>
        <input id="email" name="email" type="email" required className={inputClass}
          placeholder="your@email.com" />
        <p className="text-xs text-ink-body/50">{t("fieldEmailHint")}</p>
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
