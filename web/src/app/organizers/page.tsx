import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

type OrganizerRow = {
  id: string;
  name: string;
  official_site_url: string | null;
  region: string | null;
};

export default async function OrganizersPage() {
  let organizers: OrganizerRow[] = [];

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase
      .from("organizers")
      .select("id, name, official_site_url, region")
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch organizers:", error);
    } else {
      organizers = (data ?? []) as OrganizerRow[];
    }
  } catch (err) {
    console.error("Supabase connection error:", err);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 py-12">
      <h1 className="font-heading text-ink-heading text-3xl md:text-4xl font-bold mb-10">
        演奏団体
      </h1>

      {organizers.length === 0 ? (
        <p className="font-body text-ink-body/70 text-base py-12 text-center">
          現在登録されている演奏団体はありません
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizers.map((org) => (
            <Link key={org.id} href={`/organizers/${org.id}`} className="block group">
              <div
                className="bg-parchment-dark rounded-md p-6 h-full transition-all duration-200 ease-in-out group-hover:-translate-y-1 group-hover:shadow-[0_4px_16px_rgba(59,47,29,0.18)]"
                style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
              >
                <h2 className="font-heading text-ink-heading text-lg font-semibold leading-snug mb-3">
                  {org.name}
                </h2>
                <div className="flex flex-col gap-1">
                  {org.region && (
                    <p className="font-body text-ink-body/60 text-sm">{org.region}</p>
                  )}
                  {org.official_site_url && (
                    <p className="font-body text-bordeaux text-sm">
                      公式サイト ↗
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
