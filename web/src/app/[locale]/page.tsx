import { cookies } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { formatDateShort } from "@/utils/formatDate";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import Card from "@/components/ui/Card";
import { REGIONS, prefectureToRegion } from "@/utils/regions";
import type { Region } from "@/utils/regions";

type BroadcastRow = {
  id: string;
  program_name: string;
  channel: string | null;
  broadcast_datetime: string;
  is_replay: boolean;
};

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";
const VALID_GENRES: readonly Genre[] = ["orchestra", "wind", "rock", "acoustic", "chamber", "other"];

type CardEvent = {
  id: string;
  tour_id: string | null;
  event_name: string;
  event_name_en: string | null;
  start_datetime: string;
  venue_name: string | null;
  prefecture: string | null;
  flyer_image_url: string | null;
  key_visual_url: string | null;
  performance_type: string | null;
  organizers: { name: string } | null;
  event_game_titles: Array<{
    game_titles: { id: string; title_name: string; english_name: string | null } | null;
  }>;
};

type LightEvent = {
  id: string;
  start_datetime: string;
  prefecture: string | null;
  event_game_titles: Array<{
    game_titles: { id: string; title_name: string; english_name: string | null; igdb_cover_url: string | null } | null;
  }>;
};

function toGenre(val: string | null | undefined): Genre | undefined {
  if (val && (VALID_GENRES as readonly string[]).includes(val)) return val as Genre;
  return undefined;
}


export default async function Home() {
  const locale = await getLocale();
  const t = await getTranslations("home");
  const tb = await getTranslations("broadcasts");

  const nowUtc = new Date();
  const jstNow = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);
  const todayJst = jstNow.toISOString().substring(0, 10);
  const todayStart = `${todayJst}T00:00:00+09:00`;

  const calYear = jstNow.getUTCFullYear();
  const calMonth = jstNow.getUTCMonth(); // 0-indexed
  const daysInMonth = new Date(Date.UTC(calYear, calMonth + 1, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(calYear, calMonth, 1)).getUTCDay(); // 0=Sun

  let topEvents: CardEvent[] = [];
  let allEvents: LightEvent[] = [];
  let upcomingBroadcasts: BroadcastRow[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const broadcastEnd = new Date(nowUtc.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const [topResult, allResult, broadcastResult] = await Promise.all([
      supabase
        .from("events")
        .select(`
          id, tour_id, event_name, event_name_en, start_datetime, venue_name, prefecture,
          flyer_image_url, key_visual_url, performance_type,
          organizers ( name ),
          event_game_titles ( game_titles ( id, title_name, english_name ) )
        `)
        .eq("is_published", true)
        .gte("start_datetime", todayStart)
        .order("start_datetime", { ascending: true })
        .limit(30),
      supabase
        .from("events")
        .select(`
          id, start_datetime, prefecture,
          event_game_titles ( game_titles ( id, title_name, english_name, igdb_cover_url ) )
        `)
        .eq("is_published", true)
        .gte("start_datetime", todayStart)
        .order("start_datetime", { ascending: true }),
      supabase
        .from("broadcasts")
        .select("id, program_name, channel, broadcast_datetime, is_replay")
        .eq("is_published", true)
        .gte("broadcast_datetime", nowUtc.toISOString())
        .lte("broadcast_datetime", broadcastEnd)
        .order("broadcast_datetime", { ascending: true })
        .limit(3),
    ]);

    if (topResult.error) console.error("Failed to fetch top events:", topResult.error);
    else topEvents = (topResult.data ?? []) as unknown as CardEvent[];

    if (allResult.error) console.error("Failed to fetch all events:", allResult.error);
    else allEvents = (allResult.data ?? []) as unknown as LightEvent[];

    if (!broadcastResult.error)
      upcomingBroadcasts = (broadcastResult.data ?? []) as unknown as BroadcastRow[];
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  // Section 1: tour_id でグループ化し、代表イベント6件を選ぶ
  const tourCounts = new Map<string, number>();
  for (const ev of topEvents) {
    if (ev.tour_id) tourCounts.set(ev.tour_id, (tourCounts.get(ev.tour_id) ?? 0) + 1);
  }
  const displayEvents: CardEvent[] = [];
  const seenTourIds = new Set<string>();
  for (const ev of topEvents) {
    if (ev.tour_id) {
      if (seenTourIds.has(ev.tour_id)) continue;
      seenTourIds.add(ev.tour_id);
    }
    displayEvents.push(ev);
    if (displayEvents.length >= 6) break;
  }

  // Section 2: count events per game title
  type TitleInfo = { id: string; name: string; count: number; coverUrl: string | null };
  const titleMap = new Map<string, TitleInfo>();
  for (const ev of allEvents) {
    for (const egt of ev.event_game_titles) {
      const gt = egt.game_titles;
      if (!gt) continue;
      const existing = titleMap.get(gt.id);
      if (existing) {
        existing.count++;
      } else {
        titleMap.set(gt.id, {
          id: gt.id,
          name: locale === "en" && gt.english_name ? gt.english_name : gt.title_name,
          count: 1,
          coverUrl: gt.igdb_cover_url ?? null,
        });
      }
    }
  }
  const topTitles = [...titleMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Section 3: count events per region
  const regionCounts = new Map<Region, number>(REGIONS.map((r) => [r, 0]));
  for (const ev of allEvents) {
    const region = prefectureToRegion(ev.prefecture);
    if (region) regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
  }

  // Section 4: event days in current month for mini calendar
  const eventDays = new Set<number>();
  for (const ev of allEvents) {
    const evJst = new Date(new Date(ev.start_datetime).getTime() + 9 * 60 * 60 * 1000);
    if (evJst.getUTCFullYear() === calYear && evJst.getUTCMonth() === calMonth) {
      eventDays.add(evJst.getUTCDate());
    }
  }

  const calendarDays: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const todayDay = jstNow.getUTCDate();
  const DAY_LABELS_JA = ["日", "月", "火", "水", "木", "金", "土"];
  const DAY_LABELS_EN = ["S", "M", "T", "W", "T", "F", "S"];
  const dayLabels = locale === "ja" ? DAY_LABELS_JA : DAY_LABELS_EN;
  const monthLabel =
    locale === "ja"
      ? `${calYear}年${calMonth + 1}月`
      : new Date(Date.UTC(calYear, calMonth, 1)).toLocaleString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 min-h-screen">
      {/* Hero */}
      <section className="pt-24 pb-12 text-center border-b border-gold/30">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          <h1 className="font-heading text-bordeaux text-5xl md:text-7xl font-bold tracking-widest leading-tight">
            MINSTREL
          </h1>
          <p className="font-body text-ink-body text-lg md:text-xl tracking-wide">
            {t("heroTagline")}
          </p>
          <div className="w-24 h-px bg-gold" aria-hidden />
          <p className="font-body text-ink-body/80 text-base md:text-lg max-w-xl leading-relaxed">
            {t("heroDescription")}
          </p>
        </div>
      </section>

      {/* Section 1: 直近6件 */}
      <section className="py-12 border-b border-gold/30">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-ink-heading text-2xl md:text-3xl font-semibold">
            {t("upcomingTitle")}
          </h2>
          <Link
            href="/concerts"
            className="font-body text-bordeaux hover:text-bordeaux/70 text-sm transition-colors"
          >
            {t("seeAll")}
          </Link>
        </div>
        {displayEvents.length === 0 ? (
          <p className="font-body text-ink-body/70 text-base py-12 text-center">{t("empty")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {displayEvents.map((ev) => {
              const gameTitles = ev.event_game_titles
                .map((egt) => {
                  const gt = egt.game_titles;
                  if (!gt) return null;
                  return locale === "en" && gt.english_name ? gt.english_name : gt.title_name;
                })
                .filter((item): item is string => item != null);
              const tourCount = ev.tour_id ? (tourCounts.get(ev.tour_id) ?? 1) : undefined;
              return (
                <Card
                  key={ev.id}
                  title={ev.event_name}
                  titleEn={locale === "en" ? (ev.event_name_en ?? undefined) : undefined}
                  date={formatDateShort(ev.start_datetime, locale)}
                  venue={ev.venue_name ?? "—"}
                  prefecture={ev.prefecture ?? undefined}
                  organizer={ev.organizers?.name}
                  genre={toGenre(ev.performance_type)}
                  imageUrl={ev.flyer_image_url ?? ev.key_visual_url ?? undefined}
                  href={`/events/${ev.id}`}
                  gameTitles={gameTitles}
                  tourCount={tourCount}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: ゲームタイトルで探す */}
      <section className="py-12 border-b border-gold/30">
        <h2 className="font-heading text-ink-heading text-2xl md:text-3xl font-semibold mb-8">
          {t("gameTitlesTitle")}
        </h2>
        {topTitles.length === 0 ? (
          <p className="font-body text-ink-body/70 text-sm">{t("empty")}</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 md:gap-5">
            {topTitles.map((title) => (
              <Link
                key={title.id}
                href={`/titles/${title.id}`}
                className="group flex flex-col gap-2"
              >
                <div className="relative aspect-[3/4] bg-parchment-dark rounded overflow-hidden"
                  style={{ boxShadow: "0 2px 6px rgba(59, 47, 29, 0.12)" }}>
                  {title.coverUrl ? (
                    <Image
                      src={title.coverUrl}
                      alt={title.name}
                      fill
                      className="object-cover transition-transform duration-200 group-hover:scale-105"
                      sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-heading text-gold/40 text-3xl select-none" aria-hidden>♪</span>
                    </div>
                  )}
                  <span className="absolute top-1.5 right-1.5 bg-bordeaux/90 text-white font-body text-xs font-medium px-1.5 py-0.5 rounded leading-none tabular-nums">
                    {title.count}
                  </span>
                </div>
                <p className="font-body text-ink-body text-xs leading-snug line-clamp-2 group-hover:text-bordeaux transition-colors">
                  {title.name}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: 地域で探す */}
      <section className="py-12 border-b border-gold/30">
        <h2 className="font-heading text-ink-heading text-2xl md:text-3xl font-semibold mb-8">
          {t("regionTitle")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {REGIONS.map((region) => {
            const count = regionCounts.get(region) ?? 0;
            return (
              <Link
                key={region}
                href={`/concerts?region=${encodeURIComponent(region)}`}
                className={`flex flex-col items-center justify-center px-3 py-5 border rounded-lg text-center transition-colors ${
                  count > 0
                    ? "border-gold/40 hover:border-bordeaux hover:text-bordeaux"
                    : "border-gold/20 pointer-events-none"
                }`}
              >
                <span className={`font-body text-sm ${count > 0 ? "text-ink-body" : "text-ink-body/40"}`}>
                  {region}
                </span>
                <span
                  className={`font-heading text-2xl font-bold mt-1 ${
                    count > 0 ? "text-bordeaux" : "text-ink-body/25"
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Section 4: ミニカレンダー */}
      <section className="py-12 border-b border-gold/30">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-ink-heading text-2xl md:text-3xl font-semibold">
            {t("calendarTitle")}
          </h2>
          <Link
            href="/calendar"
            className="font-body text-bordeaux hover:text-bordeaux/70 text-sm transition-colors"
          >
            {t("viewCalendar")}
          </Link>
        </div>

        <div className="max-w-xs">
          <p className="font-heading text-ink-heading text-base font-semibold mb-3">{monthLabel}</p>
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {dayLabels.map((d, i) => (
              <span key={i} className="text-xs font-body text-ink-body/40 py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={i} />;
              const isToday = day === todayDay;
              const hasEvent = eventDays.has(day);
              return (
                <div key={i} className="flex flex-col items-center justify-center h-9">
                  <span
                    className={`text-sm font-body w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-bordeaux text-parchment font-semibold"
                        : hasEvent
                        ? "text-bordeaux font-semibold"
                        : "text-ink-body/50"
                    }`}
                  >
                    {day}
                  </span>
                  {hasEvent && !isToday && (
                    <span className="w-1 h-1 rounded-full bg-bordeaux mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 5: 放送・配信情報 */}
      {upcomingBroadcasts.length > 0 && (
        <section className="py-12 pb-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-ink-heading text-2xl md:text-3xl font-semibold">
              📺 {tb("homeTitle")}
            </h2>
            <Link
              href="/concerts?tab=broadcasts"
              className="font-body text-bordeaux hover:text-bordeaux/70 text-sm transition-colors"
            >
              {tb("seeAll")}
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {upcomingBroadcasts.map((bc) => {
              const dt = new Date(bc.broadcast_datetime);
              const m = dt.getMonth() + 1;
              const d = dt.getDate();
              const hh = String(dt.getHours()).padStart(2, "0");
              const mm = String(dt.getMinutes()).padStart(2, "0");
              const dateStr = locale === "ja" ? `${m}/${d} ${hh}:${mm}` : dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
              return (
                <li key={bc.id} className="flex items-baseline gap-3">
                  <span className="font-body text-ink-body/60 text-sm tabular-nums shrink-0">{dateStr}</span>
                  {bc.channel && (
                    <span className="font-body text-ink-body/50 text-xs shrink-0">{bc.channel}</span>
                  )}
                  <span className="font-body text-ink-body text-sm leading-snug">
                    {bc.program_name}
                    {bc.is_replay && (
                      <span className="ml-1.5 text-xs text-ink-body/50">（再放送）</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
