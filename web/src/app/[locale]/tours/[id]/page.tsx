import { cookies } from "next/headers";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { formatDateShort } from "@/utils/formatDate";
import { Link } from "@/i18n/navigation";
import Badge from "@/components/ui/Badge";
import { googleCalendarUrl } from "@/utils/ical";
import { ArrowLeft, MapPin } from "lucide-react";
import { notFound } from "next/navigation";

export const revalidate = 60;

type TourEvent = {
  id: string;
  event_name: string;
  event_name_en: string | null;
  start_datetime: string;
  end_datetime: string | null;
  venue_name: string | null;
  prefecture: string | null;
  flyer_image_url: string | null;
  key_visual_url: string | null;
  ticket_urls: { primary?: string } | null;
  description: string | null;
  organizers: { name: string; official_site_url: string | null } | null;
  event_game_titles: Array<{ game_titles: { title_name: string; english_name: string | null } | null }>;
};

export default async function TourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("event");
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: rawEvents } = await supabase
    .from("events")
    .select(`
      id, event_name, event_name_en, start_datetime, end_datetime,
      venue_name, prefecture, flyer_image_url, key_visual_url,
      ticket_urls, description,
      organizers ( name, official_site_url ),
      event_game_titles ( game_titles ( title_name, english_name ) )
    `)
    .eq("tour_id", id)
    .eq("is_published", true)
    .order("start_datetime", { ascending: true });

  if (!rawEvents || rawEvents.length === 0) notFound();

  const events = rawEvents as unknown as TourEvent[];
  const first = events[0];

  const tourName = (locale === "en" && first.event_name_en) ? first.event_name_en : first.event_name;
  const imageUrl = first.flyer_image_url ?? first.key_visual_url;
  const gameTitles = first.event_game_titles
    .map((egt) => {
      const gt = egt.game_titles;
      if (!gt) return null;
      return (locale === "en" && gt.english_name) ? gt.english_name : gt.title_name;
    })
    .filter((g): g is string => g != null);

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12 min-h-screen">
      <Link
        href="/concerts"
        className="inline-flex items-center gap-1.5 font-body text-ink-body/50 hover:text-bordeaux text-sm transition-colors mb-8"
      >
        <ArrowLeft size={14} />
        {t("backToList")}
      </Link>

      <div
        className="relative w-full aspect-video bg-parchment-dark rounded-md overflow-hidden mb-8"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        {imageUrl ? (
          <Image src={imageUrl} alt={tourName} fill className="object-cover" priority />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-heading text-gold/40 text-8xl select-none" aria-hidden>♪</span>
          </div>
        )}
      </div>

      <div
        className="bg-parchment-dark rounded-md p-6 md:p-8 flex flex-col gap-6"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold leading-snug">
          {tourName}
        </h1>

        {/* 公演リスト */}
        <div className="flex flex-col gap-3">
          <p className="font-body text-ink-body/60 text-xs tracking-wide">{t("performanceList")}</p>
          <div className="flex flex-col divide-y divide-gold/20">
            {events.map((ev) => (
              <div key={ev.id} className="py-4 flex flex-col gap-2.5">
                <div>
                  <p className="font-body text-ink-body text-sm font-medium">
                    {formatDateShort(ev.start_datetime, locale)}
                  </p>
                  {(ev.venue_name || ev.prefecture) && (
                    <p className="font-body text-ink-body/60 text-xs mt-0.5 flex items-center gap-1">
                      <MapPin size={10} strokeWidth={1.6} className="shrink-0" />
                      {ev.venue_name
                        ? `${ev.venue_name}${ev.prefecture ? `（${ev.prefecture}）` : ""}`
                        : ev.prefecture}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={googleCalendarUrl({
                      id: ev.id,
                      event_name: ev.event_name,
                      start_datetime: ev.start_datetime,
                      end_datetime: ev.end_datetime,
                      description: ev.description,
                      venue_name: ev.venue_name,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer border border-gold text-bordeaux hover:bg-gold/10 px-3 py-1.5 text-xs"
                  >
                    {t("addToGoogleCal")}
                  </a>
                  <a
                    href={`/api/events/${ev.id}/ical`}
                    className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer border border-gold/50 text-ink-body hover:bg-parchment px-3 py-1.5 text-xs"
                  >
                    {t("addToIcal")}
                  </a>
                  {ev.ticket_urls?.primary && (
                    <a
                      href={ev.ticket_urls.primary}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body rounded inline-flex items-center justify-center transition-colors cursor-pointer bg-bordeaux text-parchment hover:bg-bordeaux/80 px-3 py-1.5 text-xs"
                    >
                      {t("buyTicket")}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 演奏団体 */}
        {first.organizers && (
          <div className="border-t border-gold/30 pt-6 flex flex-col gap-0.5">
            <p className="font-body text-ink-body/60 text-xs tracking-wide">{t("organizer")}</p>
            <p className="font-body text-ink-body text-base">
              {first.organizers.official_site_url ? (
                <a
                  href={first.organizers.official_site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bordeaux hover:text-bordeaux/70 transition-colors underline underline-offset-2"
                >
                  {first.organizers.name}
                </a>
              ) : (
                first.organizers.name
              )}
            </p>
          </div>
        )}

        {/* 関連ゲームタイトル */}
        {gameTitles.length > 0 && (
          <div className="border-t border-gold/30 pt-6 flex flex-col gap-2">
            <p className="font-body text-ink-body/60 text-xs tracking-wide">{t("gameTitles")}</p>
            <div className="flex flex-wrap gap-2">
              {gameTitles.map((title) => (
                <Badge key={title} variant="other">{title}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* 概要 */}
        {first.description && (
          <div className="border-t border-gold/30 pt-6">
            <p className="font-body text-ink-body text-base leading-relaxed">
              {first.description}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
