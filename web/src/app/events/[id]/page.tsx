import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import Badge from "@/components/ui/Badge";
import { googleCalendarUrl } from "@/utils/ical";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://minstrel.live";

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";
const VALID_GENRES: readonly Genre[] = [
  "orchestra", "wind", "rock", "acoustic", "chamber", "other",
];
function toGenre(val: string | null | undefined): Genre {
  if (val && (VALID_GENRES as readonly string[]).includes(val)) return val as Genre;
  return "other";
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function formatDateWithDay(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  // Convert to JST (UTC+9) using UTC methods to avoid server timezone issues
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const w = WEEKDAYS[jst.getUTCDay()];
  return `${y}年${m}月${day}日（${w}）`;
}

type EventDetail = {
  id: string;
  event_name: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string | null;
  venue_name: string;
  prefecture: string;
  key_visual_url: string | null;
  flyer_image_url: string | null;
  performance_type: string | null;
  has_streaming: boolean;
  streaming_price: string | null;
  ticket_urls: { primary?: string } | null;
  organizers: {
    name: string;
    official_site_url: string | null;
    x_url: string | null;
  } | null;
  event_game_titles: Array<{
    game_titles: { title_name: string } | null;
  }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data } = await supabase
    .from("events")
    .select("event_name, description, start_datetime, flyer_image_url, key_visual_url")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!data) return { title: "Minstrel" };

  const imageUrl = data.flyer_image_url ?? data.key_visual_url;
  const dateStr = formatDateWithDay(data.start_datetime);
  const description = data.description ?? `${data.event_name}（${dateStr}）のゲーム音楽コンサート情報`;

  return {
    title: data.event_name,
    description,
    openGraph: {
      title: data.event_name,
      description,
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: data.event_name,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("events")
    .select(`
      id,
      event_name,
      description,
      start_datetime,
      end_datetime,
      venue_name,
      prefecture,
      key_visual_url,
      flyer_image_url,
      performance_type,
      has_streaming,
      streaming_price,
      ticket_urls,
      organizers (
        name,
        official_site_url,
        x_url
      ),
      event_game_titles (
        game_titles (
          title_name
        )
      )
    `)
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (error || !data) {
    notFound();
  }

  const event = data as unknown as EventDetail;
  const ticketUrl = event.ticket_urls?.primary ?? null;
  const gameTitles = event.event_game_titles
    .map((egt) => egt.game_titles?.title_name)
    .filter((t): t is string => t != null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.event_name,
    startDate: event.start_datetime,
    ...(event.end_datetime ? { endDate: event.end_datetime } : {}),
    location: {
      "@type": "Place",
      name: `${event.venue_name}（${event.prefecture}）`,
    },
    ...(event.description ? { description: event.description } : {}),
    ...((event.flyer_image_url ?? event.key_visual_url)
      ? { image: event.flyer_image_url ?? event.key_visual_url }
      : {}),
    ...(event.organizers
      ? {
          organizer: {
            "@type": "Organization",
            name: event.organizers.name,
            ...(event.organizers.official_site_url
              ? { url: event.organizers.official_site_url }
              : {}),
          },
        }
      : {}),
    url: `${BASE_URL}/events/${event.id}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
      {/* ── 一覧に戻るリンク ── */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 font-body text-bordeaux hover:text-bordeaux/70 transition-colors text-sm mb-8"
      >
        ← 一覧に戻る
      </Link>

      {/* ── ヒーロー画像エリア ── */}
      <div className="relative w-full aspect-video bg-parchment-dark rounded-md overflow-hidden mb-8"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        {(event.flyer_image_url ?? event.key_visual_url) ? (
          <Image
            src={(event.flyer_image_url ?? event.key_visual_url)!}
            alt={event.event_name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-heading text-gold/40 text-8xl select-none" aria-hidden>
              ♪
            </span>
          </div>
        )}
      </div>

      {/* ── コンテンツカード ── */}
      <div
        className="bg-parchment-dark rounded-md p-6 md:p-8 flex flex-col gap-6"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        {/* タイトルとジャンルバッジ */}
        <div className="flex flex-col gap-3">
          {event.performance_type && (
            <Badge variant={toGenre(event.performance_type)}>
              {event.performance_type === "orchestra" && "オーケストラ"}
              {event.performance_type === "wind"      && "吹奏楽"}
              {event.performance_type === "rock"      && "バンド"}
              {event.performance_type === "acoustic"  && "アコースティック"}
              {event.performance_type === "chamber"   && "室内楽"}
              {event.performance_type === "other"     && "その他"}
            </Badge>
          )}
          <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold leading-snug">
            {event.event_name}
          </h1>
        </div>

        {/* 基本情報 */}
        <dl className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="font-body text-ink-body/60 text-xs tracking-wide">開催日</dt>
            <dd className="font-body text-ink-body text-base">{formatDateWithDay(event.start_datetime)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-body text-ink-body/60 text-xs tracking-wide">会場</dt>
            <dd className="font-body text-ink-body text-base">
              {event.venue_name}（{event.prefecture}）
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="font-body text-ink-body/60 text-xs tracking-wide">演奏団体</dt>
            <dd className="font-body text-ink-body text-base">
              {event.organizers ? (
                event.organizers.official_site_url ? (
                  <a
                    href={event.organizers.official_site_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bordeaux hover:text-bordeaux/70 transition-colors underline underline-offset-2"
                  >
                    {event.organizers.name}
                  </a>
                ) : (
                  event.organizers.name
                )
              ) : (
                <span className="text-ink-body/50">—</span>
              )}
            </dd>
          </div>
          {event.organizers?.x_url && (
            <div className="flex flex-col gap-0.5">
              <dt className="font-body text-ink-body/60 text-xs tracking-wide">公式X</dt>
              <dd>
                <a
                  href={event.organizers.x_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-bordeaux hover:text-bordeaux/70 transition-colors text-sm underline underline-offset-2"
                >
                  {event.organizers.x_url}
                </a>
              </dd>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <dt className="font-body text-ink-body/60 text-xs tracking-wide">配信</dt>
            <dd className="font-body text-ink-body text-base">
              {event.streaming_price ?? "配信なし"}
            </dd>
          </div>
        </dl>

        {/* 関連ゲームタイトル */}
        {gameTitles.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-body text-ink-body/60 text-xs tracking-wide">関連ゲームタイトル</p>
            <div className="flex flex-wrap gap-2">
              {gameTitles.map((title) => (
                <Badge key={title} variant="other">{title}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* 説明文 */}
        {event.description && (
          <div className="border-t border-gold/30 pt-6">
            <p className="font-body text-ink-body text-base leading-relaxed">
              {event.description}
            </p>
          </div>
        )}

        {/* チケットボタン */}
        {ticketUrl && (
          <div className="border-t border-gold/30 pt-6">
            <a
              href={ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer bg-bordeaux text-parchment hover:bg-bordeaux/80 px-5 py-2.5 text-base w-full md:w-auto"
            >
              チケットを購入する
            </a>
          </div>
        )}

        {/* カレンダーボタン */}
        <div className="border-t border-gold/30 pt-6 flex flex-wrap gap-3">
          <a
            href={googleCalendarUrl({
              id: event.id,
              event_name: event.event_name,
              start_datetime: event.start_datetime,
              end_datetime: event.end_datetime,
              description: event.description,
              venue_name: event.venue_name,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer border border-gold text-bordeaux hover:bg-gold/10 px-5 py-2.5 text-sm"
          >
            Googleカレンダーに追加
          </a>
          <a
            href={`/api/events/${event.id}/ical`}
            className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer border border-gold/50 text-ink-body hover:bg-parchment-dark px-5 py-2.5 text-sm"
          >
            カレンダーに追加（.ics）
          </a>
        </div>
      </div>
    </div>
    </>
  );
}
