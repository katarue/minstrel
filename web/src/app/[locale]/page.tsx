import Image from "next/image";
import { cookies } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { formatDateShort } from "@/utils/formatDate";
import { Link } from "@/i18n/navigation";
import Card from "@/components/ui/Card";
import { TitleCoverImage } from "./titles/TitleCoverImage";
import HeroSearch from "./HeroSearch";
import JapanMapSection from "@/components/ui/JapanMapSection";
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
    game_titles: { id: string; title_name: string; english_name: string | null; igdb_cover_url: string | null; amazon_asin: string | null; key_visual_url: string | null } | null;
  }>;
};

type CalendarEvent = { id: string; tour_id: string | null; event_name: string; event_name_en: string | null; start_datetime: string; venue_name: string | null; prefecture: string | null };
type TicketSaleEvent = { id: string; tour_id: string | null; event_name: string; event_name_en: string | null; source_url: string | null; ticket_sale_start: string | null; ticket_sale_start_time: string | null; flyer_image_url: string | null; key_visual_url: string | null; prefecture: string | null };

function toGenre(val: string | null | undefined): Genre | undefined {
  if (val && (VALID_GENRES as readonly string[]).includes(val)) return val as Genre;
  return undefined;
}

// 2026-08-18: ホームの「ゲームタイトルで探す」セクションを非表示化
// （カバー画像が安定せず利用も少ないため）。復活させる場合は true に戻す。
const SHOW_GAME_TITLES = false;


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
  let calendarEvents: CalendarEvent[] = [];
  let ticketSaleUpcoming: TicketSaleEvent[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const broadcastEnd = new Date(nowUtc.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const [topResult, allResult, broadcastResult, calendarResult, ticketSaleResult] = await Promise.all([
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
          event_game_titles ( game_titles ( id, title_name, english_name, igdb_cover_url, amazon_asin, key_visual_url ) )
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
      supabase
        .from("events")
        .select("id, tour_id, event_name, event_name_en, start_datetime, venue_name, prefecture")
        .eq("is_published", true)
        .gte("start_datetime", new Date(Date.UTC(calYear, calMonth, 1)).toISOString())
        .lt("start_datetime", new Date(Date.UTC(calYear, calMonth + 1, 1)).toISOString())
        .order("start_datetime", { ascending: true }),
      supabase
        .from("events")
        .select("id, tour_id, event_name, event_name_en, source_url, ticket_sale_start, ticket_sale_start_time, flyer_image_url, key_visual_url, prefecture")
        .eq("is_published", true)
        .eq("ticket_sale_confirmed", false)
        .gte("ticket_sale_start", todayJst)
        .lte("ticket_sale_start", new Date(jstNow.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10))
        .order("ticket_sale_start", { ascending: true }),
    ]);

    if (topResult.error) console.error("Failed to fetch top events:", topResult.error);
    else topEvents = (topResult.data ?? []) as unknown as CardEvent[];

    if (allResult.error) console.error("Failed to fetch all events:", allResult.error);
    else allEvents = (allResult.data ?? []) as unknown as LightEvent[];

    if (!broadcastResult.error)
      upcomingBroadcasts = (broadcastResult.data ?? []) as unknown as BroadcastRow[];

    if (!calendarResult.error)
      calendarEvents = (calendarResult.data ?? []) as unknown as CalendarEvent[];

    if (!ticketSaleResult.error)
      ticketSaleUpcoming = (ticketSaleResult.data ?? []) as unknown as TicketSaleEvent[];
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
    if (displayEvents.length >= 6) break;
  }

  // Section 2: count events per game title
  type TitleInfo = { id: string; name: string; count: number; asin: string | null; keyVisualUrl: string | null; igdbUrl: string | null };
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
          asin: gt.amazon_asin ?? null,
          keyVisualUrl: gt.key_visual_url ?? null,
          igdbUrl: gt.igdb_cover_url ?? null,
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
  const eventsByDay: Record<number, { id: string; tour_id: string | null; event_name: string; event_name_en: string | null }[]> = {};
  for (const ev of calendarEvents) {
    const evJst = new Date(new Date(ev.start_datetime).getTime() + 9 * 60 * 60 * 1000);
    const day = evJst.getUTCDate();
    (eventsByDay[day] ??= []).push(ev);
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
          <HeroSearch />
        </div>
      </section>

      {/* チケット発売情報 */}
      {ticketSaleUpcoming.length > 0 && (
        <section className="py-8 border-b border-gold/30">
          <h2 className="font-heading text-ink-heading text-xl md:text-2xl font-semibold mb-5">
            {locale === "ja" ? "チケット発売情報" : "Ticket Sales"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3">
            {ticketSaleUpcoming.map((ev) => {
              const isToday = ev.ticket_sale_start === todayJst;
              const saleDateLabel = ev.ticket_sale_start
                ? `${parseInt(ev.ticket_sale_start.slice(5, 7))}月${parseInt(ev.ticket_sale_start.slice(8, 10))}日発売`
                : "";
              const saleTimeLabel = ev.ticket_sale_start_time
                ? ev.ticket_sale_start_time.slice(0, 5)
                : null;
              const imageUrl = ev.flyer_image_url ?? ev.key_visual_url;
              const displayName = locale === "en" ? (ev.event_name_en ?? ev.event_name) : ev.event_name;
              return (
                <a
                  key={ev.id}
                  href={ev.source_url ?? `/tours/${ev.tour_id ?? ev.id}`}
                  target={ev.source_url ? "_blank" : undefined}
                  rel={ev.source_url ? "noopener noreferrer" : undefined}
                  className="relative group flex flex-col bg-parchment-dark border border-gold/20 rounded-lg hover:border-bordeaux/40 transition-colors"
                >
                  <div className="absolute -top-3 left-3 z-10">
                    <span className={`inline-block font-body text-xs font-semibold px-2.5 py-1 rounded shadow-md whitespace-nowrap text-white ${isToday ? "bg-red-500" : "bg-bordeaux"}`}>
                      {isToday ? (locale === "ja" ? "本日発売" : "On Sale Today") : saleDateLabel}
                    </span>
                  </div>
                  <div className="relative aspect-video bg-gold/10 overflow-hidden rounded-t-lg">
                    {imageUrl ? (
                      <Image src={imageUrl} alt={displayName} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-gold/30 text-3xl">♪</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-1">
                    <p className="font-heading text-xs text-ink-heading font-semibold leading-snug line-clamp-2 group-hover:text-bordeaux transition-colors">
                      {displayName}
                    </p>
                    <div className="flex items-center justify-between mt-auto pt-1">
                      {ev.prefecture
                        ? <span className="text-xs text-ink-body/50">{ev.prefecture}</span>
                        : <span />
                      }
                      {saleTimeLabel && (
                        <span className="text-xs text-ink-body/60 font-mono">{saleTimeLabel}</span>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 1: 直近6件 */}
      <section className="py-12 border-b border-gold/30">
        <h2 className="font-heading text-ink-heading text-xl md:text-2xl font-semibold mb-8">
          {t("upcomingTitle")}
        </h2>
        {displayEvents.length === 0 ? (
          <p className="font-body text-ink-body/70 text-base py-12 text-center">{t("empty")}</p>
        ) : (
          <>
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
                <div className="relative aspect-[3/4] bg-parchment-dark rounded overflow-hidden"
                  style={{ boxShadow: "0 2px 6px rgba(59, 47, 29, 0.12)" }}>
                  <TitleCoverImage
                    asin={title.asin}
                    keyVisualUrl={title.keyVisualUrl}
                    igdbUrl={title.igdbUrl}
                    alt={title.name}
                  />
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
      <section id="calendar" className="py-12 border-b border-gold/30">
        <h2 className="font-heading text-ink-heading text-xl md:text-2xl font-semibold mb-8">
          {t("calendarTitle")}
        </h2>

        <p className="font-heading text-ink-heading text-base font-semibold mb-4">{monthLabel}</p>

        <div className="border border-gold/30 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-parchment-dark border-b border-gold/30">
            {dayLabels.map((d, i) => (
              <div key={i} className={`py-3 text-center text-sm font-heading font-semibold ${i === 0 ? "text-error" : i === 6 ? "text-info" : "text-ink-heading"}`}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(8rem, auto)" }}>
            {calendarDays.map((day, idx) => (
              <div key={idx}
                className={`p-2 border-b border-r border-gold/20 ${!day ? "bg-parchment-dark/30" : "bg-parchment"} ${idx % 7 === 6 ? "border-r-0" : ""}`}>
                {day && (
                  <>
                    <span className={`text-sm font-body font-medium ${
                      day === todayDay
                        ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-bordeaux text-parchment"
                        : idx % 7 === 0 ? "text-error" : idx % 7 === 6 ? "text-info" : "text-ink-heading"
                    }`}>
                      {day}
                    </span>
                    <div className="mt-1 flex flex-col gap-1">
                      {(eventsByDay[day] ?? []).map((ev) => (
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
            ))}
          </div>
        </div>
        {calendarEvents.length > 0 && (
          <div className="mt-10">
            <h3 className="font-heading text-ink-heading text-lg font-semibold mb-4">
              {locale === "ja"
                ? `${calYear}年${calMonth + 1}月のコンサート一覧`
                : `${new Date(Date.UTC(calYear, calMonth, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })} Concert List`}
            </h3>
            <div className="flex flex-col gap-2">
              {calendarEvents.map((ev) => {
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
