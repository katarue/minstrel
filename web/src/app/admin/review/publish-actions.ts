"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function publishEvent(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update({ is_published: true })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  revalidatePath("/admin");
  return { ok: true };
}

export async function unpublishEvent(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update({ is_published: false })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  revalidatePath("/admin");
  return { ok: true };
}
