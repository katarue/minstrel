"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

const selectClass =
  "px-3 py-2 text-sm font-body bg-parchment border border-gold/50 rounded focus:outline-none focus:border-bordeaux text-ink-body cursor-pointer";

interface Props {
  q: string;
  prefecture: string;
  genre: string;
  period: string;
}

export default function FilterForm({ q: initQ, prefecture: initPref, genre: initGenre, period: initPeriod }: Props) {
  const t = useTranslations("concerts");
  const tGenre = useTranslations("genre");
  const tPeriod = useTranslations("period");
  const router = useRouter();
  const [q, setQ] = useState(initQ);
  const [prefecture, setPrefecture] = useState(initPref);
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
  ];

  const push = (overrides: Partial<Record<string, string>> = {}) => {
    const vals: Record<string, string> = { q, prefecture, genre, period, ...overrides };
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

      <select value={prefecture} onChange={(e) => { setPrefecture(e.target.value); push({ prefecture: e.target.value }); }} className={selectClass}>
        <option value="">{t("nationwide")}</option>
        {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
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
