import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { Link } from "@/i18n/navigation";
import Badge from "@/components/ui/Badge";
import { formatDateFull } from "@/utils/formatDate";

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";
const VALID_GENRES: readonly Genre[] = ["orchestra", "wind", "rock", "acoustic", "chamber", "other"];
function toGenre(val: string | null | undefined): Genre {
  if (val && (VALID_GENRES as readonly string[]).includes(val)) return val as Genre;
  return "other";
}

type OrganizerDetail = {
  id: string; name: string; official_site_url: string | null;
  x_url: string | null; region: string | null; description: string | null;
};
type EventRow = {
  id: string; tour_id: string | null; event_name: string; start_datetime: string;
  venue_name: string; prefecture: string; performance_type: string | null;
};

export default async function OrganizerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("organizers");
  const tGenre = await getTranslations("genre");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const [orgResult, eventsResult] = await Promise.all([
    supabase.from("organizers").select("id, name, official_site_url, x_url, region, description").eq("id", id).single(),
    supabase.from("events").select("id, tour_id, event_name, start_datetime, venue_name, prefecture, performance_type")
      .eq("organizer_id", id).eq("is_published", true).order("start_datetime", { ascending: true }),
  ]);

  if (orgResult.error || !orgResult.data) notFound();
  const organizer = orgResult.data as OrganizerDetail;
  const events = (eventsResult.data ?? []) as EventRow[];

  const genreLabels: Record<Genre, string> = {
    orchestra: tGenre("orchestra"), wind: tGenre("wind"), rock: tGenre("rock"),
    acoustic: tGenre("acoustic"), chamber: tGenre("chamber"), other: tGenre("other"),
  };

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
      <Link href="/organizers" className="inline-flex items-center gap-1 font-body text-bordeaux hover:text-bordeaux/70 transition-colors text-sm mb-8">
        {t("backToList")}
      </Link>

      <div className="bg-parchment-dark rounded-md p-6 md:p-8 flex flex-col gap-4 mb-8"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}>
        <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold leading-snug">{organizer.name}</h1>
        <dl className="flex flex-col gap-3">
          {organizer.region && (
            <div className="flex flex-col gap-0.5">
              <dt className="font-body text-ink-body/60 text-xs tracking-wide">{t("region")}</dt>
              <dd className="font-body text-ink-body text-base">{organizer.region}</dd>
            </div>
          )}
          {organizer.official_site_url && (
            <div className="flex flex-col gap-0.5">
              <dt className="font-body text-ink-body/60 text-xs tracking-wide">{t("officialSite")}</dt>
              <dd>
                <a href={organizer.official_site_url} target="_blank" rel="noopener noreferrer"
                  className="font-body text-bordeaux hover:text-bordeaux/70 transition-colors text-sm underline underline-offset-2">
                  {organizer.official_site_url}
                </a>
              </dd>
            </div>
          )}
          {organizer.x_url && (
            <div className="flex flex-col gap-0.5">
              <dt className="font-body text-ink-body/60 text-xs tracking-wide">{t("officialX")}</dt>
              <dd>
                <a href={organizer.x_url} target="_blank" rel="noopener noreferrer"
                  className="font-body text-bordeaux hover:text-bordeaux/70 transition-colors text-sm underline underline-offset-2">
                  {organizer.x_url}
                </a>
              </dd>
            </div>
          )}
        </dl>
        {organizer.description && (
          <div className="border-t border-gold/30 pt-4">
            <p className="font-body text-ink-body text-base leading-relaxed">{organizer.description}</p>
          </div>
        )}
      </div>

      <section>
        <h2 className="font-heading text-ink-heading text-xl font-semibold mb-5">{t("hostedEvents")}</h2>
        {events.length === 0 ? (
          <p className="font-body text-ink-body/70 text-base py-8 text-center">{t("noEvents")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {events.map((event) => (
              <Link key={event.id} href={`/tours/${event.tour_id ?? event.id}`} className="block group">
                <div className="bg-parchment-dark rounded-md p-4 md:p-5 transition-all duration-200 ease-in-out group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_16px_rgba(59,47,29,0.18)]"
                  style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}>
                  <div className="flex flex-col gap-2">
                    {event.performance_type && (
                      <div className="flex items-start gap-2 flex-wrap">
                        <Badge variant={toGenre(event.performance_type)}>
                          {genreLabels[toGenre(event.performance_type)]}
                        </Badge>
                      </div>
                    )}
                    <p className="font-heading text-ink-heading text-base font-semibold leading-snug">{event.event_name}</p>
                    <p className="font-body text-ink-body/70 text-sm">
                      {formatDateFull(event.start_datetime, locale)}　{event.venue_name}（{event.prefecture}）
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
