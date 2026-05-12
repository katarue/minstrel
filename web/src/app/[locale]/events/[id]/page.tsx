import { cookies } from "next/headers";
import { permanentRedirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function EventRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data } = await supabase
    .from("events")
    .select("tour_id")
    .eq("id", id)
    .single();

  if (!data?.tour_id) notFound();

  permanentRedirect(`/tours/${data.tour_id}`);
}
