import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function formatDateWithDay(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const w = WEEKDAYS[jst.getUTCDay()];
  return `${y}年${m}月${day}日（${w}）`;
}

type GameTitleDetail = {
  id: string;
  title_name: string;
  series_name: string | null;
  publisher: string | null;
};

type EventRow = {
  id: string;
  event_name: string;
  start_datetime: string;
  venue_name: string;
  prefecture: string;
};

export default async function TitleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: titleData, error: titleError } = await supabase
    .from("game_titles")
    .select("id, title_name, series_name, publisher")
    .eq("id", id)
    .single();

  if (titleError || !titleData) {
    notFound();
  }

  const title = titleData as GameTitleDetail;

  const { data: eventLinks } = await supabase
    .from("event_game_titles")
    .select(`
      events (
        id,
        event_name,
        start_datetime,
        venue_name,
        prefecture
      )
    `)
    .eq("game_title_id", id)
    .eq("events.is_published", true)
    .order("created_at", { ascending: true });

  type LinkRow = { events: EventRow | EventRow[] | null };
  const events: EventRow[] = (eventLinks as unknown as LinkRow[] ?? [])
    .flatMap((link) => {
      const e = link.events;
      if (!e) return [];
      return Array.isArray(e) ? e : [e];
    })
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
      {/* 戻るリンク */}
      <Link
        href="/titles"
        className="inline-flex items-center gap-1 font-body text-bordeaux hover:text-bordeaux/70 transition-colors text-sm mb-8"
      >
        ← ゲームタイトル一覧に戻る
      </Link>

      {/* タイトル情報カード */}
      <div
        className="bg-parchment-dark rounded-md p-6 md:p-8 flex flex-col gap-4 mb-8"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold leading-snug">
          {title.title_name}
        </h1>

        <dl className="flex flex-col gap-3">
          {title.series_name && (
            <div className="flex flex-col gap-0.5">
              <dt className="font-body text-ink-body/60 text-xs tracking-wide">シリーズ</dt>
              <dd className="font-body text-ink-body text-base">{title.series_name}</dd>
            </div>
          )}
          {title.publisher && (
            <div className="flex flex-col gap-0.5">
              <dt className="font-body text-ink-body/60 text-xs tracking-wide">パブリッシャー</dt>
              <dd className="font-body text-ink-body text-base">{title.publisher}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* 関連コンサート一覧 */}
      <section>
        <h2 className="font-heading text-ink-heading text-xl font-semibold mb-5">
          関連コンサート
        </h2>

        {events.length === 0 ? (
          <p className="font-body text-ink-body/70 text-base py-8 text-center">
            現在公開中のコンサートはありません
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {events.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="block group">
                <div
                  className="bg-parchment-dark rounded-md p-4 md:p-5 transition-all duration-200 ease-in-out group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_16px_rgba(59,47,29,0.18)]"
                  style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
                >
                  <p className="font-heading text-ink-heading text-base font-semibold leading-snug mb-1">
                    {event.event_name}
                  </p>
                  <p className="font-body text-ink-body/70 text-sm">
                    {formatDateWithDay(event.start_datetime)}　{event.venue_name}（{event.prefecture}）
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
