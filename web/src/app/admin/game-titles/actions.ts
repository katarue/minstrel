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

export async function deleteOrphanedGameTitles(): Promise<{ ok: boolean; deleted: number; message?: string }> {
  const supabase = createAdminClient();

  const [{ data: allTitles }, { data: linked }] = await Promise.all([
    supabase.from("game_titles").select("id"),
    supabase.from("event_game_titles").select("game_title_id"),
  ]);

  const linkedIds = new Set((linked ?? []).map((r) => r.game_title_id));
  const orphanIds = (allTitles ?? []).filter((t) => !linkedIds.has(t.id)).map((t) => t.id);

  if (orphanIds.length === 0) return { ok: true, deleted: 0 };

  const { error } = await supabase.from("game_titles").delete().in("id", orphanIds);
  if (error) return { ok: false, deleted: 0, message: error.message };

  revalidatePath("/admin/game-titles");
  return { ok: true, deleted: orphanIds.length };
}

export async function fetchIgdbCovers(): Promise<{ ok: boolean; updated: number; skipped: number; message?: string }> {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, updated: 0, skipped: 0, message: "IGDB_CLIENT_ID / IGDB_CLIENT_SECRET が未設定です" };
  }

  const tokenRes = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!tokenRes.ok) return { ok: false, updated: 0, skipped: 0, message: "IGDBトークン取得失敗" };
  const { access_token: token } = await tokenRes.json() as { access_token: string };

  const supabase = createAdminClient();
  const { data: titles } = await supabase
    .from("game_titles")
    .select("id, title_name, english_name")
    .is("igdb_cover_url", null);

  if (!titles?.length) return { ok: true, updated: 0, skipped: 0 };

  let updated = 0;
  let skipped = 0;

  for (const title of titles) {
    const candidates = title.english_name ? [title.english_name, title.title_name] : [title.title_name];
    let url: string | null = null;

    for (const query of candidates) {
      await new Promise((r) => setTimeout(r, 250));
      const res = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` },
        body: `search "${query}"; fields name, cover.url; limit 1;`,
      });
      if (!res.ok) continue;
      const data = await res.json() as { cover?: { url?: string } }[];
      const raw = data[0]?.cover?.url;
      if (raw) {
        url = raw.replace("t_thumb", "t_cover_big");
        if (url.startsWith("//")) url = "https:" + url;
        break;
      }
    }

    if (url) {
      await supabase.from("game_titles").update({ igdb_cover_url: url }).eq("id", title.id);
      updated++;
    } else {
      skipped++;
    }
  }

  revalidatePath("/admin/game-titles");
  return { ok: true, updated, skipped };
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
