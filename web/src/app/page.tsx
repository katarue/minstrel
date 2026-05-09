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
  venue_name: string | null;
  prefecture: string | null;
  key_visual_url: string | null;
  performance_type: string | null;
  organizers: { name: string } | null;
};

type EventGroup = {
  key: string;
  dateDisplay: string;
  events: EventRow[];
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function jstParts(isoDatetime: string) {
  const d = new Date(isoDatetime);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return {
    m: jst.getUTCMonth() + 1,
    d: jst.getUTCDate(),
    w: WEEKDAYS[jst.getUTCDay()],
  };
}

function formatGroupDate(events: EventRow[]): string {
  const first = jstParts(events[0].start_datetime);
  if (events.length === 1) {
    return `${first.m}月${first.d}日（${first.w}）`;
  }
  const last = jstParts(events[events.length - 1].start_datetime);
  if (first.m === last.m) {
    return `${first.m}月${first.d}日（${first.w}）〜${last.d}日（${last.w}）`;
  }
  return `${first.m}月${first.d}日（${first.w}）〜${last.m}月${last.d}日（${last.w}）`;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (24 * 60 * 60 * 1000)
  );
}

function groupConsecutiveEvents(events: EventRow[]): EventGroup[] {
  if (events.length === 0) return [];

  const groups: EventGroup[] = [];
  let current: EventRow[] = [events[0]];

  for (let i = 1; i < events.length; i++) {
    const prev = current[current.length - 1];
    const curr = events[i];
    const gap = daysBetween(prev.start_datetime, curr.start_datetime);

    if (
      curr.event_name === prev.event_name &&
      curr.venue_name === prev.venue_name &&
      gap === 1 &&
      current.length < 5
    ) {
      current.push(curr);
    } else {
      groups.push({ key: current[0].id, dateDisplay: formatGroupDate(current), events: current });
      current = [curr];
    }
  }
  groups.push({ key: current[0].id, dateDisplay: formatGroupDate(current), events: current });

  return groups;
}

function formatVenue(venueName: string | null, prefecture: string | null): string {
  if (venueName && prefecture) return `${venueName}（${prefecture}）`;
  if (venueName) return venueName;
  if (prefecture) return prefecture;
  return "会場未定";
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
    // 本日（JST）の開始時刻を計算してフィルター
    const nowUtc = new Date();
    const jstNow = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000);
    const todayJst = jstNow.toISOString().substring(0, 10); // "YYYY-MM-DD"
    const todayStart = `${todayJst}T00:00:00+09:00`;

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
      .gte("start_datetime", todayStart)
      .order("start_datetime", { ascending: true });

    if (error) {
      console.error("Failed to fetch events:", error);
    } else {
      events = (data ?? []) as unknown as EventRow[];
    }
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  const groups = groupConsecutiveEvents(events);

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
        {groups.length === 0 ? (
          <p className="font-body text-ink-body/70 text-base py-12 text-center">
            現在掲載中のコンサートはありません
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {groups.map((group) => {
              const ev = group.events[0];
              return (
                <Card
                  key={group.key}
                  title={ev.event_name}
                  date={group.dateDisplay}
                  venue={formatVenue(ev.venue_name, ev.prefecture)}
                  organizer={ev.organizers?.name}
                  genre={toGenre(ev.performance_type)}
                  imageUrl={ev.key_visual_url ?? undefined}
                  href={`/events/${ev.id}`}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
