import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Card from "@/components/ui/Card";

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";

const VALID_GENRES: readonly Genre[] = [
  "orchestra", "wind", "rock", "acoustic", "chamber", "other",
];

type EventRow = {
  id: string;
  event_name: string;
  start_datetime: string;
  venue_name: string;
  prefecture: string;
  key_visual_url: string | null;
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

export default async function Home() {
  let events: EventRow[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase
      .from("events")
      .select(`
        id,
        event_name,
        start_datetime,
        venue_name,
        prefecture,
        key_visual_url,
        performance_type,
        organizers ( name )
      `)
      .eq("is_published", true)
      .order("start_datetime", { ascending: true });

    if (error) {
      console.error("Failed to fetch events:", error);
    } else {
      events = (data ?? []) as unknown as EventRow[];
    }
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 min-h-screen">
      {/* ── ヒーローセクション ── */}
      <section className="py-24 text-center border-b border-gold/30">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          <h1 className="font-heading text-bordeaux text-5xl md:text-7xl font-bold tracking-widest leading-tight">
            MINSTREL
          </h1>
          <p className="font-body text-ink-body text-lg md:text-xl tracking-wide">
            Game Music Concert Portal
          </p>
          <div className="w-24 h-px bg-gold" aria-hidden />
          <p className="font-body text-ink-body/80 text-base md:text-lg max-w-xl leading-relaxed">
            日本のゲーム音楽コンサート情報を集約する専門ポータル
          </p>
        </div>
      </section>

      {/* ── セクション区切り装飾 ── */}
      <div
        className="flex items-center justify-center py-8 text-gold text-2xl select-none"
        aria-hidden
      >
        ♩
      </div>

      {/* ── 開催予定のコンサート ── */}
      <section className="pb-20">
        <h2 className="font-heading text-ink-heading text-2xl md:text-3xl font-semibold mb-8">
          開催予定のコンサート
        </h2>
        {events.length === 0 ? (
          <p className="font-body text-ink-body/70 text-base py-12 text-center">
            現在掲載中のコンサートはありません
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {events.map((event) => (
              <Card
                key={event.id}
                title={event.event_name}
                date={formatEventDate(event.start_datetime)}
                venue={`${event.venue_name}（${event.prefecture}）`}
                organizer={event.organizers?.name}
                genre={toGenre(event.performance_type)}
                imageUrl={event.key_visual_url ?? undefined}
                href={`/events/${event.id}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
