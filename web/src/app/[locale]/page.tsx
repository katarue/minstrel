import { cookies } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { formatDateShort } from "@/utils/formatDate";
import { Link } from "@/i18n/navigation";
import Card from "@/components/ui/Card";
import PosterCard from "@/components/ui/PosterCard";
import HeroSearch from "./HeroSearch";
import JapanMapSection from "@/components/ui/JapanMapSection";
import CalendarSection from "@/components/calendar/CalendarSection";
import { getCalendarMonth, type CalendarEvent } from "./calendarActions";
import { REGIONS, prefectureToRegion, prefectureEn } from "@/utils/regions";
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
  venue_name_en: string | null;
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
    game_titles: { id: string; title_name: string; english_name: string | null } | null;
  }>;
};

function toGenre(val: string | null | undefined): Genre | undefined {
  if (val && (VALID_GENRES as readonly string[]).includes(val)) return val as Genre;
  return undefined;
}

// 2026-08-18: ホームの「ゲームタイトルで探す」セクションを非表示化
// （カバー画像が安定せず利用も少ないため）。復活させる場合は true に戻す。
const SHOW_GAME_TITLES = false;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("home");
  const tb = await getTranslations("broadcasts");
  const sp = await searchParams;

  const nowUtc = new Date();
  const jstNow = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);
  const todayJst = jstNow.toISOString().substring(0, 10);
  const todayStart = `${todayJst}T00:00:00+09:00`;

  const defaultMonth = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, "0")}`;
  const initialMonth = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : defaultMonth;

  let topEvents: CardEvent[] = [];
  let allEvents: LightEvent[] = [];
  let upcomingBroadcasts: BroadcastRow[] = [];
  let calendarEvents: CalendarEvent[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const broadcastEnd = new Date(nowUtc.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const [topResult, allResult, broadcastResult, monthEvents] = await Promise.all([
      supabase
        .from("events")
        .select(`
          id, tour_id, event_name, event_name_en, start_datetime, venue_name, venue_name_en, prefecture,
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
          event_game_titles ( game_titles ( id, title_name, english_name ) )
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
      getCalendarMonth(initialMonth),
    ]);

    if (topResult.error) console.error("Failed to fetch top events:", topResult.error);
    else topEvents = (topResult.data ?? []) as unknown as CardEvent[];

    if (allResult.error) console.error("Failed to fetch all events:", allResult.error);
    else allEvents = (allResult.data ?? []) as unknown as LightEvent[];

    if (!broadcastResult.error)
      upcomingBroadcasts = (broadcastResult.data ?? []) as unknown as BroadcastRow[];

    calendarEvents = monthEvents;
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  // Section 1: tour_id でグループ化し、代表イベント6件を選ぶ
  const tourCounts = new Map<string, number>();
  const tourRanges = new Map<string, { first: string; last: string }>();
  for (const ev of topEvents) {
    if (!ev.tour_id) continue;
    tourCounts.set(ev.tour_id, (tourCounts.get(ev.tour_id) ?? 0) + 1);
    const r = tourRanges.get(ev.tour_id);
    if (!r) tourRanges.set(ev.tour_id, { first: ev.start_datetime, last: ev.start_datetime });
    else {
      if (ev.start_datetime < r.first) r.first = ev.start_datetime;
      if (ev.start_datetime > r.last) r.last = ev.start_datetime;
    }
  }
  const displayEvents: CardEvent[] = [];
  const seenTourIds = new Set<string>();
  for (const ev of topEvents) {
    if (ev.tour_id) {
      if (seenTourIds.has(ev.tour_id)) continue;
      seenTourIds.add(ev.tour_id);
    }
    displayEvents.push(ev);
    if (displayEvents.length >= 9) break;
  }
  const posterEvents = displayEvents.slice(0, 3);
  const sideEvents = displayEvents.slice(3, 9);

  // Section 2: count events per game title
  type TitleInfo = { id: string; name: string; count: number };
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

  // Section 4: events per day for full calendar grid
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
          <HeroSearch />
        </div>
      </section>

      {/* Section 1: 直近6件 */}
      <section className="py-12 border-b border-gold/30">
        <h2 className="font-heading text-ink-heading text-xl md:text-2xl font-semibold mb-8">
          {t("upcomingTitle")}
        </h2>
        {displayEvents.length === 0 ? (
          <p className="font-body text-ink-body/70 text-base py-12 text-center">{t("empty")}</p>
        ) : (
          <>
            {/* 直近3件: 縦長ポスター型（スマホは横スワイプ） */}
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:grid md:grid-cols-3 md:gap-8">
              {posterEvents.map((ev) => {
                const tourCount = ev.tour_id ? (tourCounts.get(ev.tour_id) ?? 1) : undefined;
                const dateDisplay = `${formatDateShort(ev.start_datetime, locale)}${(tourCount ?? 1) > 1 ? "　他" : ""}`;
                return (
                  <PosterCard
                    key={ev.id}
                    title={locale === "en" ? (ev.event_name_en ?? ev.event_name) : ev.event_name}
                    date={dateDisplay}
                    imageUrl={ev.flyer_image_url ?? ev.key_visual_url ?? undefined}
                    href={`/tours/${ev.tour_id ?? ev.id}`}
                  />
                );
              })}
            </div>

            {/* 続く6件: 横並びカード（PC 2列 / スマホ 1列） */}
            {sideEvents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-8">
                {sideEvents.map((ev) => {
                  const gameTitles = ev.event_game_titles
                    .map((egt) => {
                      const gt = egt.game_titles;
                      if (!gt) return null;
                      return locale === "en" && gt.english_name ? gt.english_name : gt.title_name;
                    })
                    .filter((item): item is string => item != null);
                  const tourCount = ev.tour_id ? (tourCounts.get(ev.tour_id) ?? 1) : undefined;
                  const dateDisplay = `${formatDateShort(ev.start_datetime, locale)}${(tourCount ?? 1) > 1 ? "　他" : ""}`;
                  return (
                    <Card
                      key={ev.id}
                      title={locale === "en" ? (ev.event_name_en ?? ev.event_name) : ev.event_name}
                      date={dateDisplay}
                      venue={(locale === "en" && ev.venue_name_en ? ev.venue_name_en : ev.venue_name) ?? "—"}
                      prefecture={(locale === "en" ? (prefectureEn(ev.prefecture) ?? ev.prefecture) : ev.prefecture) ?? undefined}
                      organizer={ev.organizers?.name}
                      genre={toGenre(ev.performance_type)}
                      imageUrl={ev.flyer_image_url ?? ev.key_visual_url ?? undefined}
                      href={`/tours/${ev.tour_id ?? ev.id}`}
                      gameTitles={gameTitles}
                      tourCount={tourCount}
                      tourId={ev.tour_id ?? undefined}
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-10 flex justify-end">
              <Link
                href="/concerts"
                className="font-body text-bordeaux border border-bordeaux rounded px-8 py-2.5 text-sm font-medium hover:bg-bordeaux hover:text-parchment transition-colors"
              >
                {t("seeAll")}
              </Link>
            </div>
          </>
        )}
      </section>

      {/* Section 2: ゲームタイトルで探す */}
      {SHOW_GAME_TITLES && (
      <section className="py-12 border-b border-gold/30">
        <h2 className="font-heading text-ink-heading text-xl md:text-2xl font-semibold mb-8">
          {t("gameTitlesTitle")}
        </h2>
        {topTitles.length === 0 ? (
          <p className="font-body text-ink-body/70 text-sm">{t("empty")}</p>
        ) : (
          <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 md:gap-5">
            {topTitles.map((title) => (
              <Link
                key={title.id}
                href={`/titles/${title.id}`}
                className="group flex flex-col gap-2"
              >
                <div className="relative aspect-[3/4] bg-parchment-dark rounded overflow-hidden flex items-center justify-center"
                  style={{ boxShadow: "0 2px 6px rgba(59, 47, 29, 0.12)" }}>
                  <span className="font-heading text-gold/40 text-4xl select-none" aria-hidden>♪</span>
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
          <div className="mt-8 flex justify-end">
            <Link
              href="/titles"
              className="font-body text-bordeaux border border-bordeaux rounded px-8 py-2.5 text-sm font-medium hover:bg-bordeaux hover:text-parchment transition-colors"
            >
              {t("seeAll")}
            </Link>
          </div>
          </>
        )}
      </section>
      )}

      {/* Section 3: 地域で探す */}
      <section className="py-12 border-b border-gold/30">
        <h2 className="font-heading text-ink-heading text-xl md:text-2xl font-semibold mb-8">
          {t("regionTitle")}
        </h2>
        <JapanMapSection regionCounts={regionCounts} locale={locale} />
      </section>

      {/* Section 4: カレンダー */}
      <CalendarSection initialMonth={initialMonth} initialEvents={calendarEvents} />

      {/* Section 5: 放送・配信情報 */}
      {upcomingBroadcasts.length > 0 && (
        <section className="py-12 pb-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-ink-heading text-2xl md:text-3xl font-semibold">
              📺 {tb("homeTitle")}
            </h2>
            <Link
              href="/concerts"
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
