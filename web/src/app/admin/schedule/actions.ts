"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ScheduledPostCategory } from "./types";

export type PostFormValues = {
  category: ScheduledPostCategory;
  scheduled_at: string;
  body: string;
  image_urls: string[];
};

function validatePost(v: PostFormValues): string | null {
  if (!v.body.trim()) return "本文は必須です";
  if (v.body.length > 280) return "本文は280文字以内にしてください";
  if (!v.scheduled_at) return "投稿日時は必須です";
  if (new Date(v.scheduled_at) <= new Date()) return "投稿日時は未来の日時を指定してください";
  const validUrls = v.image_urls.filter(Boolean);
  if (validUrls.length > 4) return "画像URLは最大4件です";
  for (const url of validUrls) {
    if (!url.startsWith("https://")) return "画像URLは https:// で始める必要があります";
  }
  return null;
}

export async function createScheduledPost(
  values: PostFormValues
): Promise<{ ok: boolean; message?: string }> {
  const err = validatePost(values);
  if (err) return { ok: false, message: err };

  const supabase = createAdminClient();
  const { error } = await supabase.from("scheduled_posts").insert({
    category: values.category,
    scheduled_at: values.scheduled_at,
    body: values.body.trim(),
    image_urls: values.image_urls.filter(Boolean),
  });

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/schedule");
  redirect("/admin/schedule");
}

export async function updateScheduledPost(
  id: string,
  values: PostFormValues
): Promise<{ ok: boolean; message?: string }> {
  const err = validatePost(values);
  if (err) return { ok: false, message: err };

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("scheduled_posts")
    .select("status")
    .eq("id", id)
    .single();

  if (existing?.status !== "pending" && existing?.status !== "failed") {
    return { ok: false, message: "予約中または失敗ステータスの投稿のみ編集できます" };
  }

  const { error } = await supabase
    .from("scheduled_posts")
    .update({
      category: values.category,
      scheduled_at: values.scheduled_at,
      body: values.body.trim(),
      image_urls: values.image_urls.filter(Boolean),
      status: "pending",
      error_message: null,
    })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/schedule");
  redirect("/admin/schedule");
}

export async function deleteScheduledPost(
  id: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("scheduled_posts").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/schedule");
  return { ok: true };
}

export async function cancelScheduledPost(
  id: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("scheduled_posts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/schedule");
  return { ok: true };
}

export async function retryScheduledPost(
  id: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("scheduled_posts")
    .update({ status: "pending", error_message: null })
    .eq("id", id)
    .eq("status", "failed");
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/schedule");
  return { ok: true };
}

export async function duplicateScheduledPost(id: string): Promise<never> {
  redirect(`/admin/schedule/new?copy=${id}`);
}
