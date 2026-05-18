"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import type { AmazonItem } from "@/lib/amazon-pa";

export async function deleteGameTitle(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("game_titles").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/game-titles");
  return { ok: true };
}

function extractAsin(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) return trimmed.toUpperCase();
  const match = trimmed.match(/\/dp\/([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

export async function fetchAmazonByAsin(
  input: string
): Promise<{ ok: boolean; asin?: string; imageUrl?: string | null; affiliateUrl?: string; message?: string }> {
  const partnerTag = process.env.AMAZON_PARTNER_TAG;
  if (!partnerTag) return { ok: false, message: "AMAZON_PARTNER_TAG が未設定です" };

  const asin = extractAsin(input);
  if (!asin) return { ok: false, message: "Amazon URL または ASIN（10文字）を入力してください" };

  return {
    ok: true,
    asin,
    imageUrl: `https://m.media-amazon.com/images/P/${asin}.09.LZZZZZZZ.jpg`,
    affiliateUrl: `https://www.amazon.co.jp/dp/${asin}?tag=${partnerTag}`,
  };
}

export async function saveAmazonItem(
  id: string,
  item: AmazonItem
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("game_titles")
    .update({
      amazon_asin: item.asin,
      amazon_image_url: item.imageUrl,
      amazon_affiliate_url: item.affiliateUrl,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/game-titles");
  return { ok: true };
}

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
