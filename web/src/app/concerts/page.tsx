import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Card from "@/components/ui/Card";
import FilterForm from "./FilterForm";

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";

const VALID_GENRES: readonly Genre[] = [
  "orchestra", "wind", "rock", "acoustic", "chamber", "other",
];

type EventRow = {
  id: string;
  event_name: string;
  start_datetime: string;
  venue_name: string | null;
  prefecture: string | null;
  key_visual_url: string | null;
  flyer_image_url: string | null;
  performance_type: string | null;
  organizers: { name: string } | null;
};

function formatEventDate(isoDatetime: string): string {
  const datePart = isoDatetime.substring(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

function toGenre(val: string | null | undefined): Genre | undefined {
  if (val && (VALID_GENRES as readonly string[]).includes(val)) return val as Genre;
  return undefined;
}

function getPeriodRange(period: string): { gte?: string; lt?: string } {
  const now = new Date();
  if (period === "upcoming") return { gte: now.toISOString() };
  if (period === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { gte: start.toISOString(), lt: end.toISOString() };
  }
  if (period === "next_month") {
    const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    return { gte: start.toISOString(), lt: end.toISOString() };
  }
  return {};
}

export default async function ConcertsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; prefecture?: string; genre?: string; period?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const prefecture = params.prefecture ?? "";
  const genre = params.genre ?? "";
  const period = params.period ?? "upcoming";

  let events: EventRow[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    let query = supabase
      .from("events")
      .select(`
        id,
        event_name,
        start_datetime,
        venue_name,
        prefecture,
        key_visual_url,
        flyer_image_url,
        performance_type,
        organizers ( name )
      `)
      .eq("is_published", true)
      .order("start_datetime", { ascending: true });

    if (q) query = query.ilike("event_name", `%${q}%`);
    if (prefecture) query = query.eq("prefecture", prefecture);
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
        コンサート一覧
      </h1>

      <div className="bg-parchment-dark border border-gold/30 rounded-lg p-4 mb-6">
        <FilterForm q={q} prefecture={prefecture} genre={genre} period={period} />
      </div>

      <p className="font-body text-ink-body/60 text-sm mb-6">
        {events.length} 件
      </p>

      {events.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-body text-ink-body/50 text-base">
            条件に合うコンサートが見つかりませんでした
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {events.map((event) => (
            <Card
              key={event.id}
              title={event.event_name}
              date={formatEventDate(event.start_datetime)}
              venue={[event.venue_name, event.prefecture].filter(Boolean).join("（") + (event.prefecture ? "）" : "")}
              organizer={event.organizers?.name}
              genre={toGenre(event.performance_type)}
              imageUrl={event.flyer_image_url ?? event.key_visual_url ?? undefined}
              href={`/events/${event.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
