import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import CalendarNav from "./CalendarNav";

const DAYS_OF_WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = parseInt(params.year ?? String(now.getFullYear()), 10);
  const month = parseInt(params.month ?? String(now.getMonth() + 1), 10);

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: events } = await supabase
    .from("events")
    .select("id, event_name, start_datetime")
    .eq("is_published", true)
    .gte("start_datetime", monthStart.toISOString())
    .lt("start_datetime", monthEnd.toISOString())
    .order("start_datetime", { ascending: true });

  // JST (UTC+9) で日付ごとにグループ化
  const eventsByDay: Record<number, { id: string; event_name: string }[]> = {};
  for (const event of events ?? []) {
    const jst = new Date(new Date(event.start_datetime).getTime() + 9 * 3600 * 1000);
    const day = jst.getUTCDate();
    (eventsByDay[day] ??= []).push(event);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const cells: (number | null)[] = [
    ...Array<null>(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 min-h-screen py-10">
      <h1 className="font-heading text-ink-heading text-3xl md:text-4xl font-semibold mb-8">
        カレンダー
      </h1>

      <CalendarNav
        year={year} month={month}
        prevYear={prevYear} prevMonth={prevMonth}
        nextYear={nextYear} nextMonth={nextMonth}
      />

      <div className="border border-gold/30 rounded-lg overflow-hidden">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 bg-parchment-dark border-b border-gold/30">
          {DAYS_OF_WEEK.map((d, i) => (
            <div
              key={d}
              className={`py-3 text-center text-sm font-heading font-semibold ${
                i === 0 ? "text-error" : i === 6 ? "text-info" : "text-ink-heading"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => (
            <div
              key={idx}
              className={`min-h-24 p-2 border-b border-r border-gold/20 last:border-r-0 ${
                !day ? "bg-parchment-dark/30" : "bg-parchment"
              } ${idx % 7 === 6 ? "border-r-0" : ""}`}
            >
              {day && (
                <>
                  <span className={`text-sm font-body font-medium ${
                    idx % 7 === 0 ? "text-error" : idx % 7 === 6 ? "text-info" : "text-ink-heading"
                  }`}>
                    {day}
                  </span>
                  <div className="mt-1 flex flex-col gap-1">
                    {(eventsByDay[day] ?? []).map((ev) => (
                      <Link
                        key={ev.id}
                        href={`/events/${ev.id}`}
                        className="block text-xs font-body text-parchment bg-bordeaux/80 hover:bg-bordeaux rounded px-1.5 py-0.5 leading-snug truncate transition-colors"
                        title={ev.event_name}
                      >
                        {ev.event_name}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <a
          href="/api/feed/ical"
          className="font-body text-sm text-bordeaux hover:underline"
        >
          カレンダーを購読する（iCal / .ics）
        </a>
      </div>
    </div>
  );
}
