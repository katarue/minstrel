"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { REGIONS } from "@/utils/regions";

const selectClass =
  "px-3 py-2 text-sm font-body bg-parchment border border-gold/50 rounded focus:outline-none focus:border-bordeaux text-ink-body cursor-pointer";

interface Props {
  q: string;
  region: string;
  genre: string;
  period: string;
}

export default function FilterForm({ q: initQ, region: initRegion, genre: initGenre, period: initPeriod }: Props) {
  const t = useTranslations("concerts");
  const tGenre = useTranslations("genre");
  const tPeriod = useTranslations("period");
  const router = useRouter();
  const [q, setQ] = useState(initQ);
  const [region, setRegion] = useState(initRegion);
  const [genre, setGenre] = useState(initGenre);
  const [period, setPeriod] = useState(initPeriod);

  const GENRES = [
    { value: "", label: t("allGenres") },
    { value: "orchestra", label: tGenre("orchestra") },
    { value: "wind", label: tGenre("wind") },
    { value: "rock", label: tGenre("rock") },
    { value: "acoustic", label: tGenre("acoustic") },
    { value: "chamber", label: tGenre("chamber") },
    { value: "other", label: tGenre("other") },
  ];

  const PERIODS = [
    { value: "upcoming", label: tPeriod("upcoming") },
    { value: "", label: tPeriod("all") },
    { value: "this_month", label: tPeriod("thisMonth") },
    { value: "next_month", label: tPeriod("nextMonth") },
    { value: "past", label: tPeriod("past") },
  ];

  const push = (overrides: Partial<Record<string, string>> = {}) => {
    const vals: Record<string, string> = { q, region, genre, period, ...overrides };
    const params = new URLSearchParams();
    Object.entries(vals).forEach(([k, v]) => { if (v) params.set(k, v); });
    router.push(`/concerts?${params.toString()}`);
  };

  return (
    <form className="flex flex-wrap gap-3 items-end" onSubmit={(e) => { e.preventDefault(); push(); }}>
      <div className="flex-1 min-w-48">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full px-3 py-2 text-sm font-body bg-parchment border border-gold/50 rounded focus:outline-none focus:border-bordeaux text-ink-body placeholder:text-ink-body/40"
        />
      </div>

      <select value={period} onChange={(e) => { setPeriod(e.target.value); push({ period: e.target.value }); }} className={selectClass}>
        {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>

      <select value={region} onChange={(e) => { setRegion(e.target.value); push({ region: e.target.value }); }} className={selectClass}>
        <option value="">{t("nationwide")}</option>
        {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      <select value={genre} onChange={(e) => { setGenre(e.target.value); push({ genre: e.target.value }); }} className={selectClass}>
        {GENRES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select>

      <button
        type="submit"
        className="px-5 py-2 text-sm font-body bg-bordeaux text-parchment rounded hover:bg-bordeaux/80 transition-colors"
      >
        {t("searchButton")}
      </button>
    </form>
  );
}
