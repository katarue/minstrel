import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { Link } from "@/i18n/navigation";
import { formatDateFull } from "@/utils/formatDate";
import { TitleCoverImage } from "../TitleCoverImage";

type GameTitleDetail = {
  id: string;
  title_name: string;
  english_name: string | null;
  series_name: string | null;
  amazon_asin: string | null;
  key_visual_url: string | null;
  igdb_cover_url: string | null;
  amazon_affiliate_url: string | null;
};
type EventRow = { id: string; tour_id: string | null; event_name: string; start_datetime: string; venue_name: string; prefecture: string; flyer_image_url: string | null; key_visual_url: string | null };

export default async function TitleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("titles");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: titleData, error: titleError } = await supabase
    .from("game_titles")
    .select("id, title_name, english_name, series_name, amazon_asin, key_visual_url, igdb_cover_url, amazon_affiliate_url")
    .eq("id", id)
    .single();
  if (titleError || !titleData) notFound();
  const title = titleData as GameTitleDetail;

  const displayName =
    locale === "en" && title.english_name ? title.english_name : title.title_name;

  const { data: eventLinks } = await supabase
    .from("event_game_titles")
    .select(`events ( id, tour_id, event_name, start_datetime, venue_name, prefecture, flyer_image_url, key_visual_url )`)
    .eq("game_title_id", id)
    .eq("events.is_published", true)
    .order("created_at", { ascending: true });

  type LinkRow = { events: EventRow | EventRow[] | null };
  const events: EventRow[] = ((eventLinks as unknown as LinkRow[]) ?? [])
    .flatMap((link) => { const e = link.events; if (!e) return []; return Array.isArray(e) ? e : [e]; })
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));

  const affiliateUrl = title.amazon_affiliate_url
    ?? (title.amazon_asin ? `https://www.amazon.co.jp/dp/${title.amazon_asin}?tag=k0642-22` : null);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-12">
      <Link
        href="/titles"
        className="inline-flex items-center gap-1 font-body text-bordeaux hover:text-bordeaux/70 transition-colors text-sm mb-8"
      >
        {t("backToList")}
      </Link>

      <div
        className="bg-parchment-dark rounded-md overflow-hidden flex flex-col sm:flex-row gap-0 mb-8"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        <div className="relative w-full sm:w-36 aspect-[3/4] shrink-0">
          <TitleCoverImage
            asin={title.amazon_asin}
            keyVisualUrl={title.key_visual_url}
            igdbUrl={title.igdb_cover_url}
            alt={displayName}
          />
        </div>
        <div className="p-6 md:p-8 flex flex-col gap-4 justify-center">
          <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold leading-snug">
            {displayName}
          </h1>
          {title.series_name && (
            <dl className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className="font-body text-ink-body/60 text-xs tracking-wide">{t("series")}</dt>
                <dd className="font-body text-ink-body text-base">{title.series_name}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      <section>
        <h2 className="font-heading text-ink-heading text-xl font-semibold mb-5">{t("relatedConcerts")}</h2>
        {events.length === 0 ? (
          <p className="font-body text-ink-body/70 text-base py-8 text-center">{t("noConcerts")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {events.map((event) => {
              const eventImage = event.flyer_image_url ?? event.key_visual_url;
              return (
                <Link key={event.id} href={`/tours/${event.tour_id ?? event.id}`} className="block group">
                  <div
                    className="bg-parchment-dark rounded-md overflow-hidden flex items-stretch transition-all duration-200 ease-in-out group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_16px_rgba(59,47,29,0.18)]"
                    style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
                  >
                    <div className="relative w-20 shrink-0 bg-parchment-dark/60">
                      {eventImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={eventImage}
                          alt={event.event_name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="font-heading text-ink-heading/20 text-2xl font-bold">
                            {event.event_name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="px-4 py-4 md:px-5 flex flex-col justify-center gap-1">
                      <p className="font-heading text-ink-heading text-lg font-semibold leading-snug">
                        {event.event_name}
                      </p>
                      <p className="font-body text-ink-body text-base font-medium">
                        {formatDateFull(event.start_datetime, locale)}
                      </p>
                      <p className="font-body text-ink-body/60 text-sm">
                        {event.venue_name}（{event.prefecture}）
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {affiliateUrl && (
        <div className="mt-8 border-t border-gold/30 pt-6">
          <a
            href={affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="block rounded-md overflow-hidden border border-gold/20 hover:border-gold/50 transition-colors aspect-square max-w-[200px] mx-auto"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/amazon-image?asin=${title.amazon_asin}`}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          </a>
        </div>
      )}
    </div>
  );
}
