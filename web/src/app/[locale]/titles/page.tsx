import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { Link } from "@/i18n/navigation";

type GameTitleRow = { id: string; title_name: string; series_name: string | null; publisher: string | null };

export default async function TitlesPage() {
  const t = await getTranslations("titles");
  let titles: GameTitleRow[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase
      .from("game_titles")
      .select("id, title_name, series_name, publisher")
      .order("title_name", { ascending: true });
    if (error) console.error("Failed to fetch game_titles:", error);
    else titles = (data ?? []) as GameTitleRow[];
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 py-12">
      <h1 className="font-heading text-ink-heading text-3xl md:text-4xl font-bold mb-10">{t("title")}</h1>
      {titles.length === 0 ? (
        <p className="font-body text-ink-body/70 text-base py-12 text-center">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {titles.map((title) => (
            <Link key={title.id} href={`/titles/${title.id}`} className="block group">
              <div className="bg-parchment-dark rounded-md p-6 h-full transition-all duration-200 ease-in-out group-hover:-translate-y-1 group-hover:shadow-[0_4px_16px_rgba(59,47,29,0.18)]"
                style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}>
                <h2 className="font-heading text-ink-heading text-lg font-semibold leading-snug mb-3">{title.title_name}</h2>
                <div className="flex flex-col gap-1">
                  {title.series_name && <p className="font-body text-ink-body/60 text-sm">{title.series_name}</p>}
                  {title.publisher && <p className="font-body text-ink-body/50 text-sm">{title.publisher}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
