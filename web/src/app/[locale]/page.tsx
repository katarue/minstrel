import { cookies } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { formatDateRange } from "@/utils/formatDate";
import Card from "@/components/ui/Card";

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";
const VALID_GENRES: readonly Genre[] = ["orchestra", "wind", "rock", "acoustic", "chamber", "other"];

type EventRow = {
  id: string;
  event_name: string;
  start_datetime: string;
  venue_name: string | null;
  prefecture: string | null;
  flyer_image_url: string | null;
  key_visual_url: string | null;
  performance_type: string | null;
  organizers: { name: string } | null;
  event_game_titles: Array<{ game_titles: { title_name: string; english_name: string | null } | null }>;
};

type EventGroup = {
  key: string;
  dateDisplay: string;
  events: EventRow[];
};

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000));
}

function groupConsecutiveEvents(events: EventRow[], locale: string): EventGroup[] {
  if (events.length === 0) return [];
  const groups: EventGroup[] = [];
  let current: EventRow[] = [events[0]];

  for (let i = 1; i < events.length; i++) {
    const prev = current[current.length - 1];
    const curr = events[i];
    const gap = daysBetween(prev.start_datetime, curr.start_datetime);
    if (curr.event_name === prev.event_name && curr.venue_name === prev.venue_name && gap === 1 && current.length < 5) {
      current.push(curr);
    } else {
      groups.push({
        key: current[0].id,
        dateDisplay: formatDateRange(current[0].start_datetime, current[current.length - 1].start_datetime, locale),
        events: current,
      });
      current = [curr];
    }
  }
  groups.push({
    key: current[0].id,
    dateDisplay: formatDateRange(current[0].start_datetime, current[current.length - 1].start_datetime, locale),
    events: current,
  });
  return groups;
}

function formatVenue(venueName: string | null, prefecture: string | null): string {
  if (venueName && prefecture) return `${venueName}（${prefecture}）`;
  if (venueName) return venueName;
  if (prefecture) return prefecture;
  return "—";
}

function toGenre(val: string | null | undefined): Genre | undefined {
  if (val && (VALID_GENRES as readonly string[]).includes(val)) return val as Genre;
  return undefined;
}

export default async function Home() {
  const locale = await getLocale();
  const t = await getTranslations("home");
  let events: EventRow[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const nowUtc = new Date();
    const jstNow = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);
    const todayJst = jstNow.toISOString().substring(0, 10);
    const todayStart = `${todayJst}T00:00:00+09:00`;

    const { data, error } = await supabase
      .from("events")
      .select(`
        id, event_name, start_datetime, venue_name, prefecture,
        flyer_image_url, key_visual_url, performance_type,
        organizers ( name ),
        event_game_titles ( game_titles ( title_name, english_name ) )
      `)
      .eq("is_published", true)
      .gte("start_datetime", todayStart)
      .order("start_datetime", { ascending: true });

    if (error) console.error("Failed to fetch events:", error);
    else events = (data ?? []) as unknown as EventRow[];
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  const groups = groupConsecutiveEvents(events, locale);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 min-h-screen">
      <section className="py-24 text-center border-b border-gold/30">
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

      <div className="flex items-center justify-center py-8 text-gold text-2xl select-none" aria-hidden>
        ♩
      </div>

      <section className="pb-20">
        <h2 className="font-heading text-ink-heading text-2xl md:text-3xl font-semibold mb-8">
          {t("upcomingTitle")}
        </h2>
        {groups.length === 0 ? (
          <p className="font-body text-ink-body/70 text-base py-12 text-center">
            {t("empty")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {groups.map((group) => {
              const ev = group.events[0];
              const gameTitles = ev.event_game_titles
                .map((egt) => {
                  const gt = egt.game_titles;
                  if (!gt) return null;
                  return (locale === "en" && gt.english_name) ? gt.english_name : gt.title_name;
                })
                .filter((t): t is string => t != null);
              return (
                <Card
                  key={group.key}
                  title={ev.event_name}
                  date={group.dateDisplay}
                  venue={formatVenue(ev.venue_name, ev.prefecture)}
                  organizer={ev.organizers?.name}
                  genre={toGenre(ev.performance_type)}
                  imageUrl={ev.flyer_image_url ?? ev.key_visual_url ?? undefined}
                  href={`/events/${ev.id}`}
                  gameTitles={gameTitles}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
