import Image from "next/image";
import { cookies } from "next/headers";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { Link } from "@/i18n/navigation";

type GameTitleRow = {
  id: string;
  title_name: string;
  english_name: string | null;
  series_name: string | null;
  publisher: string | null;
  igdb_cover_url: string | null;
};

export default async function TitlesPage() {
  const t = await getTranslations("titles");
  const locale = await getLocale();
  let titles: GameTitleRow[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const now = new Date().toISOString();

    const [titlesResult, linksResult] = await Promise.all([
      supabase
        .from("game_titles")
        .select("id, title_name, english_name, series_name, publisher, igdb_cover_url"),
      supabase
        .from("event_game_titles")
        .select("game_title_id, events!inner(id)")
        .eq("events.is_published", true)
        .gte("events.start_datetime", now),
    ]);

    if (titlesResult.error) console.error("Failed to fetch game_titles:", titlesResult.error);
    else titles = (titlesResult.data ?? []) as GameTitleRow[];

    const upcomingCount: Record<string, number> = {};
    for (const link of (linksResult.data ?? [])) {
      const id = link.game_title_id as string;
      upcomingCount[id] = (upcomingCount[id] ?? 0) + 1;
    }

    titles.sort((a, b) => {
      const ca = upcomingCount[a.id] ?? 0;
      const cb = upcomingCount[b.id] ?? 0;
      if (ca !== cb) return cb - ca;
      return a.title_name.localeCompare(b.title_name, "ja");
    });
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 py-12">
      <h1 className="font-heading text-ink-heading text-3xl md:text-4xl font-bold mb-10">{t("title")}</h1>
      {titles.length === 0 ? (
        <p className="font-body text-ink-body/70 text-base py-12 text-center">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
          {titles.map((title) => {
            const displayName =
              locale === "en" && title.english_name ? title.english_name : title.title_name;
            return (
              <Link key={title.id} href={`/titles/${title.id}`} className="block group">
                <div
                  className="rounded-md overflow-hidden transition-all duration-200 ease-in-out group-hover:-translate-y-1 group-hover:shadow-[0_6px_20px_rgba(59,47,29,0.22)]"
                  style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
                >
                  <div className="relative aspect-[3/4] bg-parchment-dark">
                    {title.igdb_cover_url ? (
                      <Image
                        src={title.igdb_cover_url}
                        alt={displayName}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full px-2">
                        <span className="font-heading text-ink-heading/25 text-3xl font-bold text-center leading-tight">
                          {displayName.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="bg-parchment-dark px-3 py-2.5">
                    <p className="font-heading text-ink-heading text-xs font-semibold leading-snug line-clamp-2">
                      {displayName}
                    </p>
                    {title.series_name && (
                      <p className="font-body text-ink-body/50 text-xs mt-0.5 truncate">{title.series_name}</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
