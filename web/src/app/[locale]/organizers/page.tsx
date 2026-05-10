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
  x_last_active_at: string | null;
};

export default async function OrganizersPage() {
  const t = await getTranslations("organizers");
  let organizers: OrganizerRow[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data, error } = await supabase
      .from("organizers")
      .select("id, name, x_url, x_profile_image_url, x_last_active_at")
      .not("x_url", "is", null)
      .gte("x_last_active_at", oneYearAgo.toISOString())
      .order("name", { ascending: true });

    if (error) console.error("Failed to fetch organizers:", error);
    else organizers = (data ?? []) as OrganizerRow[];
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
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-6 md:gap-8">
          {organizers.map((org) => (
            <Link key={org.id} href={`/organizers/${org.id}`} className="group flex flex-col items-center gap-3">
              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-parchment-dark ring-2 ring-gold/20 group-hover:ring-bordeaux/50 transition-all duration-200 shrink-0">
                {org.x_profile_image_url ? (
                  <Image
                    src={org.x_profile_image_url}
                    alt={org.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-heading text-gold/40 text-2xl select-none" aria-hidden>♪</span>
                  </div>
                )}
              </div>
              <p className="font-body text-ink-body text-xs text-center leading-snug line-clamp-3 group-hover:text-bordeaux transition-colors w-full">
                {org.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
