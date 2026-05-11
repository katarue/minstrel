import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { formatDateShort } from "@/utils/formatDate";
import { Link } from "@/i18n/navigation";
import { MapPin, ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export const revalidate = 60;

export default async function TourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  type TourEvent = {
    id: string;
    event_name: string;
    event_name_en: string | null;
    start_datetime: string;
    venue_name: string | null;
    prefecture: string | null;
    organizers: { name: string } | null;
  };

  const { data: rawEvents } = await supabase
    .from("events")
    .select("id, event_name, event_name_en, start_datetime, venue_name, prefecture, flyer_image_url, key_visual_url, organizers(name)")
    .eq("tour_id", id)
    .eq("is_published", true)
    .order("start_datetime", { ascending: true });

  if (!rawEvents || rawEvents.length === 0) notFound();

  const events = rawEvents as unknown as TourEvent[];
  const tourName = events[0].event_name;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 lg:px-20 py-10 min-h-screen">
      <Link
        href="/concerts"
        className="inline-flex items-center gap-1.5 font-body text-ink-body/50 hover:text-bordeaux text-sm transition-colors mb-8"
      >
        <ArrowLeft size={14} />
        コンサート一覧に戻る
      </Link>

      <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-semibold leading-snug mb-1">
        {tourName}
      </h1>
      <p className="font-body text-ink-body/50 text-sm mb-8">
        全{events.length}公演
      </p>

      <div className="flex flex-col divide-y divide-gold/20">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="py-5 flex items-start gap-4 group"
          >
            <div className="w-36 shrink-0">
              <p className="font-body text-ink-body text-sm">
                {formatDateShort(event.start_datetime, locale)}
              </p>
              {event.prefecture && (
                <p className="font-body text-ink-body/60 text-xs mt-0.5">
                  {event.prefecture}
                </p>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-heading text-ink-heading text-base font-semibold leading-snug group-hover:text-bordeaux transition-colors">
                {locale === "en" && event.event_name_en
                  ? event.event_name_en
                  : event.event_name}
              </p>
              {event.venue_name && (
                <p className="font-body text-ink-body/60 text-sm mt-1 flex items-center gap-1.5">
                  <MapPin size={12} strokeWidth={1.6} className="shrink-0" />
                  {event.venue_name}
                </p>
              )}
              {event.organizers?.name && (
                <p className="font-body text-ink-body/40 text-xs mt-0.5">
                  {event.organizers.name}
                </p>
              )}
            </div>

            <span className="font-body text-ink-body/30 group-hover:text-bordeaux/60 transition-colors self-center text-sm">
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
