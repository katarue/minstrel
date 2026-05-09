import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { toVEvent, buildIcal } from "@/utils/ical";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://minstrel.live";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data } = await supabase
    .from("events")
    .select("id, event_name, start_datetime, description, venue_name")
    .eq("is_published", true)
    .gte("start_datetime", new Date().toISOString())
    .order("start_datetime", { ascending: true });

  const vevents = (data ?? []).map((e) => toVEvent(e, BASE_URL));
  const ical = buildIcal(vevents, "Minstrel - ゲーム音楽コンサート");

  return new Response(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="minstrel-concerts.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
