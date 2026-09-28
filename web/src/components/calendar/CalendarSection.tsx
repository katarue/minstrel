"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCalendarMonth, type CalendarEvent } from "@/app/[locale]/calendarActions";

const DAY_LABELS_JA = ["日", "月", "火", "水", "木", "金", "土"];
const DAY_LABELS_EN = ["S", "M", "T", "W", "T", "F", "S"];

function parseMonth(monthStr: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (m) return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

interface Props {
  initialMonth: string; // YYYY-MM
  initialEvents: CalendarEvent[];
}

export default function CalendarSection({ initialMonth, initialEvents }: Props) {
  const t = useTranslations("home");
  const tCal = useTranslations("calendar");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [monthStr, setMonthStr] = useState(initialMonth);
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [isPending, startTransition] = useTransition();

  const { year, month } = parseMonth(monthStr);
  const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const isCurrentMonth = todayJst.getUTCFullYear() === year && todayJst.getUTCMonth() + 1 === month;
  const todayDay = isCurrentMonth ? todayJst.getUTCDate() : -1;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const calendarDays: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const ev of events) {
    const jst = new Date(new Date(ev.start_datetime).getTime() + 9 * 60 * 60 * 1000);
    const day = jst.getUTCDate();
    (eventsByDay[day] ??= []).push(ev);
  }

  const dayLabels = locale === "ja" ? DAY_LABELS_JA : DAY_LABELS_EN;
  const monthLabel =
    locale === "ja"
      ? `${year}年${month}月`
      : new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const goToMonth = (targetYear: number, targetMonth: number) => {
    const nextMonthStr = formatMonth(targetYear, targetMonth);
    startTransition(async () => {
      const nextEvents = await getCalendarMonth(nextMonthStr);
      setMonthStr(nextMonthStr);
      setEvents(nextEvents);
      const params = new URLSearchParams(window.location.search);
      params.set("month", nextMonthStr);
      router.replace(`${pathname}?${params.toString()}#calendar`, { scroll: false });
    });
  };

  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);

  return (
    <section id="calendar" className="py-12 border-b border-gold/30 scroll-mt-20">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <h2 className="font-heading text-ink-heading text-xl md:text-2xl font-semibold">
          {t("calendarTitle")}
        </h2>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/feed/ical" className="font-body text-sm text-bordeaux hover:underline">
          {tCal("subscribe")}
        </a>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => goToMonth(prev.year, prev.month)}
          disabled={isPending}
          className="font-body text-sm px-4 py-2 border border-gold/50 rounded hover:bg-parchment-dark transition-colors text-ink-body disabled:opacity-40"
          aria-label="前の月"
        >
          ←
        </button>
        <p className="font-heading text-ink-heading text-base font-semibold">{monthLabel}</p>
        <button
          onClick={() => goToMonth(next.year, next.month)}
          disabled={isPending}
          className="font-body text-sm px-4 py-2 border border-gold/50 rounded hover:bg-parchment-dark transition-colors text-ink-body disabled:opacity-40"
          aria-label="次の月"
        >
          →
        </button>
      </div>

      <div className={`border border-gold/30 rounded-lg overflow-hidden transition-opacity ${isPending ? "opacity-50" : ""}`}>
        <div className="grid grid-cols-7 bg-parchment-dark border-b border-gold/30">
          {dayLabels.map((d, i) => (
            <div key={i} className={`py-3 text-center text-sm font-heading font-semibold ${i === 0 ? "text-error" : i === 6 ? "text-info" : "text-ink-heading"}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(3.5rem, auto)" }}>
          {calendarDays.map((day, idx) => {
            const dayEvents = day ? (eventsByDay[day] ?? []) : [];
            return (
              <div key={idx}
                className={`p-1.5 md:p-2 border-b border-r border-gold/20 ${!day ? "bg-parchment-dark/30" : "bg-parchment"} ${idx % 7 === 6 ? "border-r-0" : ""}`}>
                {day && (
                  <>
                    <span className={`text-sm font-body font-medium ${
                      day === todayDay
                        ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-bordeaux text-parchment"
                        : idx % 7 === 0 ? "text-error" : idx % 7 === 6 ? "text-info" : "text-ink-heading"
                    }`}>
                      {day}
                    </span>
                    {/* スマホ: 公演がある日は印だけ */}
                    {dayEvents.length > 0 && (
                      <div className="md:hidden mt-1 flex justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-bordeaux" aria-hidden />
                      </div>
                    )}
                    {/* PC: 公演名リンクを表示 */}
                    <div className="hidden md:flex mt-1 flex-col gap-1">
                      {dayEvents.map((ev) => (
                        <Link key={ev.id} href={`/tours/${ev.tour_id ?? ev.id}`}
                          className="block text-xs font-body text-parchment bg-bordeaux/80 hover:bg-bordeaux rounded px-1.5 py-0.5 leading-snug truncate transition-colors"
                          title={locale === "en" ? (ev.event_name_en ?? ev.event_name) : ev.event_name}>
                          {locale === "en" ? (ev.event_name_en ?? ev.event_name) : ev.event_name}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {events.length > 0 && (
        <div className="mt-10">
          <h3 className="font-heading text-ink-heading text-lg font-semibold mb-4">
            {locale === "ja" ? `${monthLabel}のコンサート一覧` : `${monthLabel} Concert List`}
          </h3>
          <div className="flex flex-col gap-2">
            {events.map((ev) => {
              const jst = new Date(new Date(ev.start_datetime).getTime() + 9 * 3600 * 1000);
              const dateStr = locale === "ja"
                ? `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}（${"日月火水木金土"[jst.getUTCDay()]}）`
                : `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} (${"SMTWTFS"[jst.getUTCDay()]})`;
              const timeStr = `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
              const displayName = locale === "en" ? (ev.event_name_en ?? ev.event_name) : ev.event_name;
              return (
                <Link key={ev.id} href={`/tours/${ev.tour_id ?? ev.id}`}
                  className="flex items-center gap-4 bg-parchment-dark hover:bg-gold/10 border border-gold/20 rounded-md px-4 py-3 transition-colors group">
                  <span className="font-body text-sm text-ink-body/60 shrink-0 w-28 whitespace-nowrap">{dateStr} {timeStr}</span>
                  <span className="font-heading text-ink-heading text-sm font-semibold flex-1 group-hover:text-bordeaux transition-colors">{displayName}</span>
                  {ev.prefecture && (
                    <span className="font-body text-xs text-ink-body/50 shrink-0">{ev.prefecture}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
