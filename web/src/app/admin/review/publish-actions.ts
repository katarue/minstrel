"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function publishEvent(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();

  // 対象イベント取得
  const { data: target, error: targetError } = await supabase
    .from("events")
    .select("event_name, start_datetime, venue_name, prefecture, organizer_id, flyer_image_url, key_visual_url, source_url")
    .eq("id", id)
    .single();

  if (!target) return { ok: false, message: targetError?.message ?? "イベントが見つかりません" };

  // ── 品質ゲート（8必須フィールド） ─────────────────────────────────────
  if (!target.flyer_image_url && !target.key_visual_url)
    return { ok: false, message: "フライヤー/キービジュアルが登録されていません" };
  if (!target.venue_name)
    return { ok: false, message: "会場名が登録されていません" };
  if (!target.prefecture)
    return { ok: false, message: "都道府県が登録されていません" };
  if (!target.start_datetime)
    return { ok: false, message: "開催日時が登録されていません" };
  {
    const jst = new Date(new Date(target.start_datetime).getTime() + 9 * 60 * 60 * 1000);
    if (jst.getUTCHours() === 0 && jst.getUTCMinutes() === 0)
      return { ok: false, message: "開催時間が未確定です。フライヤーまたは公式サイトで確認してください" };
  }
  if (!target.source_url)
    return { ok: false, message: "ソースURLが登録されていません" };

  if (target?.start_datetime) {
    const dateStr = target.start_datetime.substring(0, 10);

    // チェック1: 同名+同日時
    if (target.event_name) {
      const { data: nameMatch } = await supabase
        .from("events")
        .select("id, event_name")
        .eq("event_name", target.event_name)
        .eq("is_published", true)
        .eq("start_datetime", target.start_datetime)
        .neq("id", id)
        .limit(1);
      if (nameMatch && nameMatch.length > 0) {
        return { ok: false, message: `同名・同日時のイベントが既に公開されています:「${nameMatch[0].event_name}」` };
      }
    }

    // チェック2: 同会場+同日時（会場名スペース除去後に一致）
    if (target.venue_name) {
      const normalize = (s: string) => s.replace(/\s/g, "");
      const { data: sameSlot } = await supabase
        .from("events")
        .select("id, event_name, venue_name")
        .eq("is_published", true)
        .eq("start_datetime", target.start_datetime)
        .neq("id", id);
      const venueMatch = (sameSlot ?? []).find(
        (ev) => ev.venue_name && normalize(ev.venue_name) === normalize(target.venue_name!)
      );
      if (venueMatch) {
        return { ok: false, message: `同日時・同会場のイベントが既に公開されています:「${venueMatch.event_name}」` };
      }
    }

    // チェック3: 会場情報なし + 同主催 + 同日
    if (!target.venue_name && target.organizer_id) {
      const { data: sameOrgDay } = await supabase
        .from("events")
        .select("id, event_name")
        .eq("organizer_id", target.organizer_id)
        .eq("is_published", true)
        .gte("start_datetime", `${dateStr}T00:00:00+00:00`)
        .lt("start_datetime", `${dateStr}T23:59:59+00:00`)
        .neq("id", id)
        .limit(1);
      if (sameOrgDay && sameOrgDay.length > 0) {
        return { ok: false, message: `同日・同主催のイベントが既に公開されています:「${sameOrgDay[0].event_name}」（会場未確定のため要確認）` };
      }
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

export async function saveDescription(id: string, description: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update({ description: description.trim() || null })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  return { ok: true };
}

export async function saveOfficialUrl(id: string, url: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update({ official_url: url.trim() || null })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  return { ok: true };
}

export async function clearEventImage(id: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();

  const { data: ev } = await supabase
    .from("events")
    .select("flyer_image_url, key_visual_url")
    .eq("id", id)
    .single();

  const storagePrefix = "/storage/v1/object/public/event-images/";
  for (const url of [ev?.flyer_image_url, ev?.key_visual_url]) {
    if (!url) continue;
    const idx = url.indexOf(storagePrefix);
    if (idx !== -1) {
      const path = decodeURIComponent(url.slice(idx + storagePrefix.length));
      await supabase.storage.from("event-images").remove([path]);
    }
  }

  const { error } = await supabase
    .from("events")
    .update({ flyer_image_url: null, key_visual_url: null })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  return { ok: true };
}

export async function saveSourceUrl(id: string, url: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update({ source_url: url.trim() || null })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  return { ok: true };
}

export async function saveTicketSaleStart(id: string, date: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update({ ticket_sale_start: date || null })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  revalidatePath("/");
  return { ok: true };
}

export async function saveTicketSaleStartTime(id: string, time: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update({ ticket_sale_start_time: time || null })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  return { ok: true };
}

export async function saveSeriesName(id: string, name: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const trimmed = name.trim() || null;

  // series_name が設定される場合、同名の既存イベントから tour_id を探して統一する
  let tourId: string | null = null;
  if (trimmed) {
    const { data: siblings } = await supabase
      .from("events")
      .select("tour_id")
      .eq("series_name", trimmed)
      .not("tour_id", "is", null)
      .limit(1);
    tourId = siblings?.[0]?.tour_id ?? crypto.randomUUID();

    // 同じ series_name を持つ全イベントに同一 tour_id を付与
    await supabase.from("events").update({ tour_id: tourId }).eq("series_name", trimmed);
  }

  const { error } = await supabase
    .from("events")
    .update({ series_name: trimmed, ...(trimmed ? { tour_id: tourId } : {}) })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  revalidatePath("/");
  return { ok: true };
}

export async function saveReferenceUrl(id: string, url: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("events")
    .update({ reference_url: url.trim() || null })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/review");
  return { ok: true };
}

export async function saveImageFromUrl(id: string, imageUrl: string): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  try {
    const res = await fetch(imageUrl.trim(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { ok: false, message: "画像のダウンロードに失敗しました" };
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const path = `${id}/flyer_manual.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("event-images")
      .upload(path, buffer, { contentType, upsert: true });
    if (uploadError) return { ok: false, message: uploadError.message };
    const publicUrl = supabase.storage.from("event-images").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("events").update({ flyer_image_url: publicUrl }).eq("id", id);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/admin/review");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "エラー" };
  }
}

export async function updateGameTitles(id: string, titles: string[]): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();

  const { error: delError } = await supabase
    .from("event_game_titles")
    .delete()
    .eq("event_id", id);

  if (delError) return { ok: false, message: delError.message };

  for (const titleName of titles) {
    const trimmed = titleName.trim();
    if (!trimmed) continue;

    const { data: existing } = await supabase
      .from("game_titles").select("id").eq("title_name", trimmed).single();

    const gtId = existing?.id ?? (
      await supabase.from("game_titles").insert({ title_name: trimmed }).select("id").single()
    ).data?.id;

    if (gtId) {
      await supabase.from("event_game_titles").insert({ event_id: id, game_title_id: gtId });
    }
  }

  revalidatePath("/admin/review");
  return { ok: true };
}
