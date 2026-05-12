import { cookies } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { formatDateShort } from "@/utils/formatDate";
import Card from "@/components/ui/Card";
import FilterForm from "./FilterForm";
import ConcertsTabs from "./ConcertsTabs";
import { REGION_PREFECTURES } from "@/utils/regions";
import type { Region } from "@/utils/regions";

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";
const VALID_GENRES: readonly Genre[] = ["orchestra", "wind", "rock", "acoustic", "chamber", "other"];

type EventRow = {
  id: string;
  tour_id: string | null;
  event_name: string;
  event_name_en: string | null;
  start_datetime: string;
  venue_name: string | null;
  prefecture: string | null;
  key_visual_url: string | null;
  flyer_image_url: string | null;
  performance_type: string | null;
  organizers: { name: string } | null;
  event_game_titles: Array<{ game_titles: { title_name: string; english_name: string | null } | null }>;
};

type BroadcastRow = {
  id: string;
  program_name: string;
  channel: string | null;
  broadcast_datetime: string;
  is_replay: boolean;
  vod_url: string | null;
  description: string | null;
  broadcasters: { name: string } | null;
};

function toGenre(val: string | null | undefined): Genre | undefined {
  if (val && (VALID_GENRES as readonly string[]).includes(val)) return val as Genre;
  return undefined;
}

function getPeriodRange(period: string): { gte?: string; lt?: string } {
  const now = new Date();
  if (period === "upcoming") return { gte: now.toISOString() };
  if (period === "past") return { lt: now.toISOString() };
  if (period === "this_month") {
    return {
      gte: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      lt: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    };
  }
  if (period === "next_month") {
    return {
      gte: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      lt: new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString(),
    };
  }
  return {};
}

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

function formatBroadcastDate(iso: string, locale: string): string {
  const dt = new Date(iso);
  if (locale === "ja") {
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    const dow = WEEKDAYS_JA[dt.getDay()];
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${m}/${d}（${dow}）${hh}:${mm}`;
  }
  return dt.toLocaleString("en-US", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function ConcertsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; prefecture?: string; genre?: string; period?: string; region?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab === "broadcasts" ? "broadcasts" : "concerts";
  const q = params.q ?? "";
  const prefecture = params.prefecture ?? "";
  const genre = params.genre ?? "";
  const period = params.period ?? "upcoming";
  const region = params.region ?? "";

  const locale = await getLocale();
  const t = await getTranslations("concerts");
  const tb = await getTranslations("broadcasts");

  let events: EventRow[] = [];
  let broadcasts: BroadcastRow[] = [];

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    if (tab === "broadcasts") {
      const { data, error } = await supabase
        .from("broadcasts")
        .select("id, program_name, channel, broadcast_datetime, is_replay, vod_url, description, broadcasters(name)")
        .eq("is_published", true)
        .gte("broadcast_datetime", new Date().toISOString())
        .order("broadcast_datetime", { ascending: true });
      if (error) console.error("Failed to fetch broadcasts:", error);
      else broadcasts = (data ?? []) as unknown as BroadcastRow[];
    } else {
      const ascending = period !== "past";
      let query = supabase
        .from("events")
        .select(`
          id, tour_id, event_name, event_name_en, start_datetime, venue_name, prefecture,
          key_visual_url, flyer_image_url, performance_type,
          organizers ( name ),
          event_game_titles ( game_titles ( title_name, english_name ) )
        `)
        .eq("is_published", true)
        .order("start_datetime", { ascending });

      if (q) {
        const { data: gtData } = await supabase
          .from("game_titles")
          .select("id")
          .or(`title_name.ilike.%${q}%,english_name.ilike.%${q}%`);
        const gtIds = (gtData ?? []).map((g: { id: string }) => g.id);

        let matchedEventIds: string[] = [];
        if (gtIds.length > 0) {
          const { data: egtData } = await supabase
            .from("event_game_titles")
            .select("event_id")
            .in("game_title_id", gtIds);
          matchedEventIds = (egtData ?? []).map((e: { event_id: string }) => e.event_id);
        }

        if (matchedEventIds.length > 0) {
          query = query.or(`event_name.ilike.%${q}%,id.in.(${matchedEventIds.join(",")})`);
        } else {
          query = query.ilike("event_name", `%${q}%`);
        }
      }
      if (prefecture) {
        query = query.eq("prefecture", prefecture);
      } else if (region && region in REGION_PREFECTURES) {
        const keywords = REGION_PREFECTURES[region as Region];
        const orFilter = keywords.map((k) => `prefecture.ilike.%${k}%`).join(",");
        query = query.or(orFilter);
      }
      if (genre) query = query.eq("performance_type", genre);

      const range = getPeriodRange(period);
      if (range.gte) query = query.gte("start_datetime", range.gte);
      if (range.lt) query = query.lt("start_datetime", range.lt);

      const { data, error } = await query;
      if (error) console.error("Failed to fetch events:", error);
      else events = (data ?? []) as unknown as EventRow[];
    }
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 min-h-screen py-10">
      <h1 className="font-heading text-ink-heading text-3xl md:text-4xl font-semibold mb-8">
        {t("title")}
      </h1>

      <ConcertsTabs
        active={tab}
        concertsLabel={t("tabConcerts")}
        broadcastsLabel={t("tabBroadcasts")}
      />

      {tab === "broadcasts" ? (
        broadcasts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-body text-ink-body/50 text-base">{tb("empty")}</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gold/20">
            {broadcasts.map((bc) => (
              <div key={bc.id} className="py-5 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="sm:w-48 shrink-0">
                  <p className="font-body text-ink-body text-sm tabular-nums">
                    {formatBroadcastDate(bc.broadcast_datetime, locale)}
                  </p>
                  {bc.channel && (
                    <p className="font-body text-ink-body/60 text-xs mt-0.5">{bc.channel}</p>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading text-ink-heading text-base font-semibold leading-snug">
                    {bc.program_name}
                    {bc.is_replay && (
                      <span className="ml-2 text-xs font-body font-normal bg-gold/20 text-ink-body/70 px-1.5 py-0.5 rounded">
                        {tb("replay")}
                      </span>
                    )}
                  </p>
                  {bc.broadcasters?.name && (
                    <p className="font-body text-ink-body/60 text-xs mt-0.5">{bc.broadcasters.name}</p>
                  )}
                  {bc.description && (
                    <p className="font-body text-ink-body/70 text-sm mt-1 leading-relaxed">{bc.description}</p>
                  )}
                  {bc.vod_url && (
                    <a
                      href={bc.vod_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 font-body text-bordeaux hover:text-bordeaux/70 text-xs transition-colors"
                    >
                      {tb("vod")} →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="bg-parchment-dark border border-gold/30 rounded-lg p-4 mb-6">
            <FilterForm q={q} region={region} genre={genre} period={period} />
          </div>

          <p className="font-body text-ink-body/60 text-sm mb-6">
            {t("resultsCount", { count: events.length })}
          </p>

          {events.length === 0 ? (
            <div className="py-20 text-center">
              <p className="font-body text-ink-body/50 text-base">{t("empty")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {(() => {
                // ツアー内の公演数・日程レンジを集計
                const tourCounts = new Map<string, number>();
                const tourRanges = new Map<string, { first: string; last: string }>();
                events.forEach((e) => {
                  if (!e.tour_id) return;
                  tourCounts.set(e.tour_id, (tourCounts.get(e.tour_id) ?? 0) + 1);
                  const r = tourRanges.get(e.tour_id);
                  if (!r) tourRanges.set(e.tour_id, { first: e.start_datetime, last: e.start_datetime });
                  else {
                    if (e.start_datetime < r.first) r.first = e.start_datetime;
                    if (e.start_datetime > r.last) r.last = e.start_datetime;
                  }
                });
                // tour_id ごとに代表1枚のみ表示
                const seenTourIds = new Set<string>();
                return events.filter((e) => {
                  if (!e.tour_id) return true;
                  if (seenTourIds.has(e.tour_id)) return false;
                  seenTourIds.add(e.tour_id);
                  return true;
                }).map((event) => {
                  const gameTitles = event.event_game_titles
                    .map((egt) => {
                      const gt = egt.game_titles;
                      if (!gt) return null;
                      return (locale === "en" && gt.english_name) ? gt.english_name : gt.title_name;
                    })
                    .filter((t): t is string => t != null);
                  const tourCount = event.tour_id ? tourCounts.get(event.tour_id) : undefined;
                  const dateDisplay = `${formatDateShort(event.start_datetime, locale)}${(tourCount ?? 1) > 1 ? "　他" : ""}`;
                  return (
                    <Card
                      key={event.id}
                      title={event.event_name}
                      titleEn={locale === "en" ? (event.event_name_en ?? undefined) : undefined}
                      date={dateDisplay}
                      venue={event.venue_name ?? "—"}
                      prefecture={event.prefecture ?? undefined}
                      organizer={event.organizers?.name}
                      genre={toGenre(event.performance_type)}
                      imageUrl={event.flyer_image_url ?? event.key_visual_url ?? undefined}
                      href={`/tours/${event.tour_id ?? event.id}`}
                      gameTitles={gameTitles}
                      tourCount={tourCount}
                      tourId={event.tour_id ?? undefined}
                      isPast={period === "past"}
                    />
                  );
                });
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
