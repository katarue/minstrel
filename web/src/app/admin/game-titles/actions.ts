"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function saveGameTitle(
  id: string,
  fields: { key_visual_url?: string; publisher?: string; series_name?: string }
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const update: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(fields)) {
    update[k] = typeof v === "string" ? v.trim() || null : null;
  }
  const { error } = await supabase.from("game_titles").update(update).eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/game-titles");
  return { ok: true };
}
