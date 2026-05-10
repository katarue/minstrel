import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { Link } from "@/i18n/navigation";
import Image from "next/image";

type OrganizerRow = {
  id: string;
  name: string;
  x_url: string | null;
  x_profile_image_url: string | null;
};

export default async function OrganizersPage() {
  const t = await getTranslations("organizers");
  let organizers: OrganizerRow[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // 過去1年以内にコンサートが登録されている organizer_id を抽出
    const { data: recentEvents } = await supabase
      .from("events")
      .select("organizer_id")
      .eq("is_published", true)
      .gte("start_datetime", oneYearAgo.toISOString())
      .not("organizer_id", "is", null);

    const activeIds = [
      ...new Set(
        (recentEvents ?? [])
          .map((e: { organizer_id: string | null }) => e.organizer_id)
          .filter((id): id is string => id != null)
      ),
    ];

    if (activeIds.length > 0) {
      const { data, error } = await supabase
        .from("organizers")
        .select("id, name, x_url, x_profile_image_url")
        .not("x_url", "is", null)
        .in("id", activeIds)
        .order("name", { ascending: true });

      if (error) console.error("Failed to fetch organizers:", error);
      else organizers = (data ?? []) as OrganizerRow[];
    }
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 py-12">
      <h1 className="font-heading text-ink-heading text-3xl md:text-4xl font-bold mb-3">{t("title")}</h1>
      <p className="font-body text-ink-body/60 text-sm mb-10">{t("activeGroupsNote")}</p>

      {organizers.length === 0 ? (
        <p className="font-body text-ink-body/70 text-base py-12 text-center">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {organizers.map((org) => (
            <Link key={org.id} href={`/organizers/${org.id}`}
              className="group flex items-center gap-4 px-4 py-3 rounded-lg border border-gold/20 bg-parchment hover:border-bordeaux/40 hover:bg-parchment-dark/30 transition-all duration-200">
              <div className="relative w-12 h-12 rounded-full overflow-hidden bg-parchment-dark ring-1 ring-gold/20 group-hover:ring-bordeaux/40 transition-all shrink-0">
                {org.x_profile_image_url ? (
                  <Image
                    src={org.x_profile_image_url}
                    alt={org.name}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-heading text-gold/40 text-lg select-none" aria-hidden>♪</span>
                  </div>
                )}
              </div>
              <p className="font-body text-ink-body text-sm leading-snug line-clamp-2 group-hover:text-bordeaux transition-colors">
                {org.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
