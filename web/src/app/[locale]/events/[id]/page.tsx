import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { Link } from "@/i18n/navigation";
import Badge from "@/components/ui/Badge";
import { googleCalendarUrl } from "@/utils/ical";
import { formatDateFull } from "@/utils/formatDate";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://minstrel.live";

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";
const VALID_GENRES: readonly Genre[] = ["orchestra", "wind", "rock", "acoustic", "chamber", "other"];
function toGenre(val: string | null | undefined): Genre {
  if (val && (VALID_GENRES as readonly string[]).includes(val)) return val as Genre;
  return "other";
}

type EventDetail = {
  id: string;
  tour_id: string | null;
  event_name: string;
  event_name_en: string | null;
  description: string | null;
  start_datetime: string;
  venue_name: string;
  prefecture: string;
  key_visual_url: string | null;
  flyer_image_url: string | null;
  performance_type: string | null;
  ticket_urls: { primary?: string } | null;
  organizers: { name: string; official_site_url: string | null; x_url: string | null } | null;
  event_game_titles: Array<{ game_titles: { title_name: string; english_name: string | null } | null }>;
};

type TourSibling = {
  id: string;
  event_name: string;
  start_datetime: string;
  venue_name: string;
  prefecture: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
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
  const dateStr = formatDateFull(data.start_datetime, locale);
  const description = data.description ?? `${data.event_name}（${dateStr}）`;

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
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations("event");
  const tGenre = await getTranslations("genre");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("events")
    .select(`
      id, tour_id, event_name, event_name_en, description, start_datetime, venue_name, prefecture,
      key_visual_url, flyer_image_url, performance_type, ticket_urls,
      organizers ( name, official_site_url, x_url ),
      event_game_titles ( game_titles ( title_name, english_name ) )
    `)
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (error || !data) notFound();

  const event = data as unknown as EventDetail;

  // ツアーの他の公演を取得
  let tourSiblings: TourSibling[] = [];
  if (event.tour_id) {
    const { data: siblings } = await supabase
      .from("events")
      .select("id, event_name, start_datetime, venue_name, prefecture")
      .eq("tour_id", event.tour_id)
      .neq("id", event.id)
      .eq("is_published", true)
      .order("start_datetime", { ascending: true });
    tourSiblings = (siblings ?? []) as TourSibling[];
  }
  const ticketUrl = event.ticket_urls?.primary ?? null;
  const gameTitles = event.event_game_titles
    .map((egt) => {
      const gt = egt.game_titles;
      if (!gt) return null;
      return (locale === "en" && gt.english_name) ? gt.english_name : gt.title_name;
    })
    .filter((t): t is string => t != null);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue_name} ${event.prefecture}`)}`;

  const genreLabels: Record<Genre, string> = {
    orchestra: tGenre("orchestra"),
    wind: tGenre("wind"),
    rock: tGenre("rock"),
    acoustic: tGenre("acoustic"),
    chamber: tGenre("chamber"),
    other: tGenre("other"),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.event_name,
    startDate: event.start_datetime,
    location: { "@type": "Place", name: `${event.venue_name}（${event.prefecture}）` },
    ...(event.description ? { description: event.description } : {}),
    ...((event.flyer_image_url ?? event.key_visual_url) ? { image: event.flyer_image_url ?? event.key_visual_url } : {}),
    ...(event.organizers ? {
      organizer: {
        "@type": "Organization",
        name: event.organizers.name,
        ...(event.organizers.official_site_url ? { url: event.organizers.official_site_url } : {}),
      },
    } : {}),
    url: `${BASE_URL}/events/${event.id}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-body text-bordeaux hover:text-bordeaux/70 transition-colors text-sm mb-8"
        >
          {t("backToList")}
        </Link>

        <div className="relative w-full aspect-video bg-parchment-dark rounded-md overflow-hidden mb-8"
          style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}>
          {(event.flyer_image_url ?? event.key_visual_url) ? (
            <Image
              src={(event.flyer_image_url ?? event.key_visual_url)!}
              alt={event.event_name}
              fill className="object-cover" priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-heading text-gold/40 text-8xl select-none" aria-hidden>♪</span>
            </div>
          )}
        </div>

        <div className="bg-parchment-dark rounded-md p-6 md:p-8 flex flex-col gap-6"
          style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}>
          <div className="flex flex-col gap-3">
            {event.performance_type && (
              <Badge variant={toGenre(event.performance_type)}>
                {genreLabels[toGenre(event.performance_type)]}
              </Badge>
            )}
            <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold leading-snug">
              {event.event_name}
            </h1>
            {locale === "en" && event.event_name_en && (
              <p className="font-body text-ink-body/50 text-sm italic leading-snug">
                {event.event_name_en}
              </p>
            )}
          </div>

          <dl className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <dt className="font-body text-ink-body/60 text-xs tracking-wide">{t("date")}</dt>
              <dd className="font-body text-ink-body text-base">{formatDateFull(event.start_datetime, locale)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-body text-ink-body/60 text-xs tracking-wide">{t("venue")}</dt>
              <dd className="font-body text-ink-body text-base">
                {event.venue_name}（{event.prefecture}）{" "}
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bordeaux hover:text-bordeaux/70 transition-colors text-xs underline underline-offset-2"
                >
                  {t("mapsLink")}
                </a>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="font-body text-ink-body/60 text-xs tracking-wide">{t("organizer")}</dt>
              <dd className="font-body text-ink-body text-base">
                {event.organizers ? (
                  event.organizers.official_site_url ? (
                    <a
                      href={event.organizers.official_site_url}
                      target="_blank" rel="noopener noreferrer"
                      className="text-bordeaux hover:text-bordeaux/70 transition-colors underline underline-offset-2"
                    >
                      {event.organizers.name}
                    </a>
                  ) : event.organizers.name
                ) : (
                  <span className="text-ink-body/50">—</span>
                )}
              </dd>
            </div>
            {event.organizers?.x_url && (
              <div className="flex flex-col gap-0.5">
                <dt className="font-body text-ink-body/60 text-xs tracking-wide">{t("officialX")}</dt>
                <dd>
                  <a
                    href={event.organizers.x_url}
                    target="_blank" rel="noopener noreferrer"
                    className="font-body text-bordeaux hover:text-bordeaux/70 transition-colors text-sm underline underline-offset-2"
                  >
                    {event.organizers.x_url}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          {gameTitles.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-body text-ink-body/60 text-xs tracking-wide">{t("gameTitles")}</p>
              <div className="flex flex-wrap gap-2">
                {gameTitles.map((title) => (
                  <Badge key={title} variant="other">{title}</Badge>
                ))}
              </div>
            </div>
          )}

          {event.description && (
            <div className="border-t border-gold/30 pt-6">
              <p className="font-body text-ink-body text-base leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {tourSiblings.length > 0 && (
            <div className="border-t border-gold/30 pt-6 flex flex-col gap-3">
              <p className="font-body text-ink-body/60 text-xs tracking-wide">{t("tourOtherDates")}</p>
              <ul className="flex flex-col gap-2">
                {tourSiblings.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/events/${s.id}`}
                      className="flex items-baseline gap-2 font-body text-sm text-bordeaux hover:text-bordeaux/70 transition-colors"
                    >
                      <span className="shrink-0">{formatDateFull(s.start_datetime, locale)}</span>
                      <span className="text-ink-body/50 truncate">{s.venue_name}（{s.prefecture}）</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ticketUrl && (
            <div className="border-t border-gold/30 pt-6">
              <a
                href={ticketUrl}
                target="_blank" rel="noopener noreferrer"
                className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer bg-bordeaux text-parchment hover:bg-bordeaux/80 px-5 py-2.5 text-base w-full md:w-auto"
              >
                {t("buyTicket")}
              </a>
            </div>
          )}

          <div className="border-t border-gold/30 pt-6 flex flex-wrap gap-3">
            <a
              href={googleCalendarUrl({
                id: event.id, event_name: event.event_name,
                start_datetime: event.start_datetime,
                description: event.description, venue_name: event.venue_name,
              })}
              target="_blank" rel="noopener noreferrer"
              className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer border border-gold text-bordeaux hover:bg-gold/10 px-5 py-2.5 text-sm"
            >
              {t("addToGoogleCal")}
            </a>
            <a
              href={`/api/events/${event.id}/ical`}
              className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer border border-gold/50 text-ink-body hover:bg-parchment-dark px-5 py-2.5 text-sm"
            >
              {t("addToIcal")}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
