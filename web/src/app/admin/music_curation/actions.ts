"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import type { MusicCurationStatus } from "./types";

export async function updateMusicCurationStatus(
  id: string,
  status: MusicCurationStatus
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("music_curation")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/music_curation");
  return { ok: true };
}

export async function updateMusicCurationNotes(
  id: string,
  notes: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("music_curation")
    .update({ notes: notes.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/music_curation");
  return { ok: true };
}

export async function deleteMusicCuration(
  id: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("music_curation").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/music_curation");
  return { ok: true };
}

export async function updateMusicCurationScheduledWeek(
  id: string,
  scheduledWeek: string | null
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("music_curation")
    .update({ scheduled_week: scheduledWeek || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/music_curation");
  return { ok: true };
}
