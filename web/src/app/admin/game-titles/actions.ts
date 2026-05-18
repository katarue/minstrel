"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { searchAmazonSoundtrack, type AmazonItem } from "@/lib/amazon-pa";

export async function deleteGameTitle(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("game_titles").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/game-titles");
  return { ok: true };
}

export async function searchAmazonForTitle(
  gameTitle: string
): Promise<{ ok: boolean; items?: AmazonItem[]; message?: string; debug?: Record<string, unknown> }> {
  const accessKey  = process.env.AMAZON_ACCESS_KEY_ID;
  const secretKey  = process.env.AMAZON_SECRET_ACCESS_KEY;
  const partnerTag = process.env.AMAZON_PARTNER_TAG;
  if (!accessKey || !secretKey || !partnerTag) {
    return {
      ok: false,
      message: "Amazon PA API の環境変数が未設定です",
      debug: {
        hasAccessKey: !!accessKey,
        hasSecretKey: !!secretKey,
        hasPartnerTag: !!partnerTag,
      },
    };
  }
  const debug = {
    accessKeyPrefix: accessKey.slice(0, 4),
    accessKeyLength: accessKey.length,
    secretKeyLength: secretKey.length,
    partnerTag,
  };
  try {
    const items = await searchAmazonSoundtrack(gameTitle, accessKey, secretKey, partnerTag);
    return { ok: true, items };
  } catch (e) {
    return { ok: false, message: String(e), debug };
  }
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
