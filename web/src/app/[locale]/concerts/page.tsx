import { cookies } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { formatDateShort } from "@/utils/formatDate";
import Card from "@/components/ui/Card";
import FilterForm from "./FilterForm";
import { REGION_PREFECTURES } from "@/utils/regions";
import type { Region } from "@/utils/regions";

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";
const VALID_GENRES: readonly Genre[] = ["orchestra", "wind", "rock", "acoustic", "chamber", "other"];

type EventRow = {
  id: string;
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

function toGenre(val: string | null | undefined): Genre | undefined {
  if (val && (VALID_GENRES as readonly string[]).includes(val)) return val as Genre;
  return undefined;
}

function getPeriodRange(period: string): { gte?: string; lt?: string } {
  const now = new Date();
  if (period === "upcoming") return { gte: now.toISOString() };
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

export default async function ConcertsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; prefecture?: string; genre?: string; period?: string; region?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const prefecture = params.prefecture ?? "";
  const genre = params.genre ?? "";
  const period = params.period ?? "upcoming";
  const region = params.region ?? "";

  const locale = await getLocale();
  const t = await getTranslations("concerts");
  let events: EventRow[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let query = supabase
      .from("events")
      .select(`
        id, event_name, event_name_en, start_datetime, venue_name, prefecture,
        key_visual_url, flyer_image_url, performance_type,
        organizers ( name ),
        event_game_titles ( game_titles ( title_name, english_name ) )
      `)
      .eq("is_published", true)
      .order("start_datetime", { ascending: true });

    if (q) query = query.ilike("event_name", `%${q}%`);
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
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 min-h-screen py-10">
      <h1 className="font-heading text-ink-heading text-3xl md:text-4xl font-semibold mb-8">
        {t("title")}
      </h1>

      <div className="bg-parchment-dark border border-gold/30 rounded-lg p-4 mb-6">
        <FilterForm q={q} prefecture={prefecture} genre={genre} period={period} />
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
          {events.map((event) => {
            const gameTitles = event.event_game_titles
              .map((egt) => {
                const gt = egt.game_titles;
                if (!gt) return null;
                return (locale === "en" && gt.english_name) ? gt.english_name : gt.title_name;
              })
              .filter((t): t is string => t != null);
            return (
              <Card
                key={event.id}
                title={event.event_name}
                titleEn={locale === "en" ? (event.event_name_en ?? undefined) : undefined}
                date={formatDateShort(event.start_datetime, locale)}
                venue={event.venue_name ?? "—"}
                prefecture={event.prefecture ?? undefined}
                organizer={event.organizers?.name}
                genre={toGenre(event.performance_type)}
                imageUrl={event.flyer_image_url ?? event.key_visual_url ?? undefined}
                href={`/events/${event.id}`}
                gameTitles={gameTitles}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
