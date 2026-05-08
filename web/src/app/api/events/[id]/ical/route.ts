import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { toVEvent, buildIcal } from "@/utils/ical";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://minstrel.live";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data } = await supabase
    .from("events")
    .select("id, event_name, start_datetime, end_datetime, description, venue_name")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!data) return new Response("Not found", { status: 404 });

  const ical = buildIcal([toVEvent(data, BASE_URL)], data.event_name);
  return new Response(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="minstrel-event.ics"`,
    },
  });
}
