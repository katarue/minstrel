"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function rejectSource(id: string) {
  const supabase = createAdminClient();
  await supabase
    .from("event_sources")
    .update({ match_status: "rejected" })
    .eq("id", id);
  revalidatePath("/admin/review");
  revalidatePath("/admin");
}
