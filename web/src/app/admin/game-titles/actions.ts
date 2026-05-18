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

function extractOgMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]+)"`, "i"),
    new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${property}"`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

export async function fetchAmazonByAsin(
  asin: string
): Promise<{ ok: boolean; title?: string; imageUrl?: string | null; affiliateUrl?: string; message?: string }> {
  const partnerTag = process.env.AMAZON_PARTNER_TAG;
  if (!partnerTag) return { ok: false, message: "AMAZON_PARTNER_TAG が未設定です" };

  const trimmed = asin.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(trimmed)) {
    return { ok: false, message: "ASIN は 10 文字の英数字です" };
  }

  try {
    const res = await fetch(`https://www.amazon.co.jp/dp/${trimmed}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ja-JP,ja;q=0.9",
        "Accept": "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!res.ok) return { ok: false, message: `Amazon: HTTP ${res.status}` };

    const html = await res.text();
    const title = extractOgMeta(html, "og:title");
    const imageUrl = extractOgMeta(html, "og:image");

    if (!title) return { ok: false, message: "商品が見つかりません（ASIN を確認してください）" };

    return {
      ok: true,
      title,
      imageUrl,
      affiliateUrl: `https://www.amazon.co.jp/dp/${trimmed}?tag=${partnerTag}`,
    };
  } catch (e) {
    return { ok: false, message: String(e) };
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
