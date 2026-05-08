"use client";

import { useRouter } from "next/navigation";

interface Props {
  year: number;
  month: number;
  prevYear: number;
  prevMonth: number;
  nextYear: number;
  nextMonth: number;
}

export default function CalendarNav({ year, month, prevYear, prevMonth, nextYear, nextMonth }: Props) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between mb-6">
      <button
        onClick={() => router.push(`/calendar?year=${prevYear}&month=${prevMonth}`)}
        className="font-body text-sm px-4 py-2 border border-gold/50 rounded hover:bg-parchment-dark transition-colors text-ink-body"
      >
        ← 前月
      </button>
      <h2 className="font-heading text-ink-heading text-xl font-semibold">
        {year}年{month}月
      </h2>
      <button
        onClick={() => router.push(`/calendar?year=${nextYear}&month=${nextMonth}`)}
        className="font-body text-sm px-4 py-2 border border-gold/50 rounded hover:bg-parchment-dark transition-colors text-ink-body"
      >
        次月 →
      </button>
    </div>
  );
}
