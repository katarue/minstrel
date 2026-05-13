"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function publishEvent(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();

  // 公開前に同名+同日の重複チェック
  const { data: target } = await supabase
    .from("events")
    .select("event_name, start_datetime")
    .eq("id", id)
    .single();

  if (target?.event_name && target?.start_datetime) {
    const dateStr = target.start_datetime.substring(0, 10);
    const { data: existing } = await supabase
      .from("events")
      .select("id, start_datetime")
      .eq("event_name", target.event_name)
      .eq("is_published", true)
      .gte("start_datetime", `${dateStr}T00:00:00+00:00`)
      .lt("start_datetime", `${dateStr}T23:59:59+00:00`)
      .neq("id", id)
      .limit(1);

    if (existing && existing.length > 0) {
      return { ok: false, message: `同名・同日のイベントが既に公開されています（ID: ${existing[0].id}）` };
    }
  }

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

export async function deleteEvent(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  revalidatePath("/admin");
  return { ok: true };
}
