import type { MetadataRoute } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://minstrel.live";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: events } = await supabase
    .from("events")
    .select("id, start_datetime")
    .eq("is_published", true)
    .order("start_datetime", { ascending: false });

  const eventUrls: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
    url: `${BASE_URL}/events/${e.id}`,
    lastModified: new Date(e.start_datetime),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    { url: BASE_URL, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/concerts`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/calendar`, changeFrequency: "daily", priority: 0.8 },
    ...eventUrls,
  ];
}
