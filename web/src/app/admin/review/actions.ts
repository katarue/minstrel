"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function rejectSource(id: string) {
  const supabase = createAdminClient();
  await supabase
    .from("event_sources")
    .update({ match_status: "rejected" })
    .eq("id", id);
  revalidatePath("/admin/review");
  revalidatePath("/admin");
}

type ApproveResult =
  | { status: "merged"; eventId: string }
  | { status: "created"; eventId: string }
  | { status: "error"; message: string };

export async function approveSource(id: string): Promise<ApproveResult> {
  const supabase = createAdminClient();

  // 1. ソースレコードを取得
  const { data: source } = await supabase
    .from("event_sources")
    .select("raw_data, source_url, source_name")
    .eq("id", id)
    .single();

  if (!source) return { status: "error", message: "レコードが見つかりません" };

  const raw = source.raw_data as Record<string, unknown>;
  const eventName = typeof raw.title === "string" ? raw.title.trim() : null;
  const startDatetime = typeof raw.start_datetime === "string" ? raw.start_datetime : null;

  if (!eventName || !startDatetime) {
    return { status: "error", message: "タイトルまたは日時が不足しています" };
  }

  // 2. 重複検知（名前 + 日付の完全一致）
  const dateStr = startDatetime.substring(0, 10);
  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("event_name", eventName)
    .gte("start_datetime", `${dateStr}T00:00:00+00:00`)
    .lt("start_datetime", `${dateStr}T23:59:59+00:00`)
    .limit(1);

  if (existing && existing.length > 0) {
    // 既存イベントに紐付け
    const existingEventId = existing[0].id as string;
    await supabase
      .from("event_sources")
      .update({ event_id: existingEventId, match_status: "matched" })
      .eq("id", id);
    revalidatePath("/admin/review");
    revalidatePath("/admin");
    return { status: "merged", eventId: existingEventId };
  }

  // 3. 主催者を find-or-create
  const organizerName = typeof raw.organizer_name === "string" ? raw.organizer_name.trim() : null;
  let organizerId: string | null = null;
  if (organizerName) {
    const { data: org } = await supabase
      .from("organizers")
      .select("id")
      .eq("name", organizerName)
      .limit(1);
    if (org && org.length > 0) {
      organizerId = org[0].id as string;
    } else {
      const { data: newOrg } = await supabase
        .from("organizers")
        .insert({ name: organizerName })
        .select("id")
        .single();
      organizerId = (newOrg?.id as string) ?? null;
    }
  }

  // 4. 新規イベントを作成（未公開）
  const confidence = typeof raw.confidence_score === "number" ? raw.confidence_score : null;
  const { data: newEvent } = await supabase
    .from("events")
    .insert({
      event_name: eventName,
      start_datetime: startDatetime,
      venue_name: typeof raw.venue === "string" ? raw.venue : null,
      prefecture: typeof raw.prefecture === "string" ? raw.prefecture : null,
      organizer_id: organizerId,
      source_url: source.source_url,
      source_rank: typeof raw.source_rank === "string" ? raw.source_rank : "C",
      confidence_score: confidence !== null ? Math.round(confidence * 100) : null,
      is_published: false,
      auto_publish_eligible: false,
    })
    .select("id")
    .single();

  if (!newEvent) return { status: "error", message: "イベント作成に失敗しました" };
  const newEventId = newEvent.id as string;

  // 5. ソースを紐付け
  await supabase
    .from("event_sources")
    .update({ event_id: newEventId, match_status: "matched" })
    .eq("id", id);

  // 6. ゲームタイトルを登録
  const gameTitles = Array.isArray(raw.game_titles) ? (raw.game_titles as string[]) : [];
  for (const gtName of gameTitles) {
    if (!gtName) continue;
    const { data: gt } = await supabase
      .from("game_titles")
      .select("id")
      .eq("title_name", gtName)
      .limit(1);
    let gtId: string | null = null;
    if (gt && gt.length > 0) {
      gtId = gt[0].id as string;
    } else {
      const { data: newGt } = await supabase
        .from("game_titles")
        .insert({ title_name: gtName })
        .select("id")
        .single();
      gtId = (newGt?.id as string) ?? null;
    }
    if (gtId) {
      await supabase
        .from("event_game_titles")
        .insert({ event_id: newEventId, game_title_id: gtId })
        .then(() => {}, () => {});
    }
  }

  revalidatePath("/admin/review");
  revalidatePath("/admin");
  return { status: "created", eventId: newEventId };
}
