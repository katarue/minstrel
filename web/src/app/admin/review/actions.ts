"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SKIP_DOMAINS = ["twitter.com", "x.com", "t.co", "instagram.com", "facebook.com", "youtube.com", "youtu.be", "lit.link", "linktr.ee"];

function extractExternalUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s　-〿＀-￯、。！？「」【】（）[\]]+/g;
  const matches = text.match(urlRegex) ?? [];
  return matches.filter(url => !SKIP_DOMAINS.some(d => url.includes(d)));
}

type EnrichedFields = {
  start_datetime?: string | null;
  venue?: string | null;
  prefecture?: string | null;
  organizer_name?: string | null;
};

async function enrichFromUrl(url: string): Promise<EnrichedFields | null> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Minstrel/1.0; +https://minstrel.live)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 4000);

    const result = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `以下のイベントページのテキストから、開催日時・会場・都道府県・主催者名を抽出してください。
JSON形式のみで返してください（説明不要）:
{"start_datetime":"ISO8601形式またはnull","venue":"string or null","prefecture":"都道府県名（例:東京都）or null","organizer_name":"string or null"}

テキスト:
${text}`,
      }],
    });

    const block = result.content[0];
    if (block.type !== "text") return null;
    const jsonMatch = block.text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as EnrichedFields;
  } catch {
    return null;
  }
}

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
  | { status: "created"; eventId: string; enriched: boolean }
  | { status: "error"; message: string };

export async function approveSource(id: string): Promise<ApproveResult> {
  const supabase = createAdminClient();

  const { data: source } = await supabase
    .from("event_sources")
    .select("raw_data, source_url, source_name")
    .eq("id", id)
    .single();

  if (!source) return { status: "error", message: "レコードが見つかりません" };

  const raw = source.raw_data as Record<string, unknown>;
  let eventName = typeof raw.title === "string" ? raw.title.trim() : null;
  let startDatetime = typeof raw.start_datetime === "string" ? raw.start_datetime : null;
  let venue = typeof raw.venue === "string" ? raw.venue : null;
  let prefecture = typeof raw.prefecture === "string" ? raw.prefecture : null;
  let organizerName = typeof raw.organizer_name === "string" ? raw.organizer_name.trim() : null;
  let enriched = false;

  // ── 日時が未取得の場合、ツイート内URLから補完を試みる ──────────────
  if (!startDatetime) {
    const tweetText = typeof raw._tweet_text === "string" ? raw._tweet_text : null;
    const urls = tweetText ? extractExternalUrls(tweetText) : [];
    if (urls.length > 0) {
      const fetched = await enrichFromUrl(urls[0]);
      if (fetched) {
        if (fetched.start_datetime) { startDatetime = fetched.start_datetime; enriched = true; }
        if (fetched.venue && !venue) venue = fetched.venue;
        if (fetched.prefecture && !prefecture) prefecture = fetched.prefecture;
        if (fetched.organizer_name && !organizerName) organizerName = fetched.organizer_name;
      }
    }
  }

  if (!eventName) return { status: "error", message: "タイトルが取得できませんでした" };
  if (!startDatetime) return { status: "error", message: "日時を取得できませんでした。公式ページのURLがツイートに含まれているか確認してください" };

  // ── 重複検知 ────────────────────────────────────────────────────────
  const dateStr = startDatetime.substring(0, 10);
  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("event_name", eventName)
    .gte("start_datetime", `${dateStr}T00:00:00+00:00`)
    .lt("start_datetime", `${dateStr}T23:59:59+00:00`)
    .limit(1);

  if (existing && existing.length > 0) {
    const existingEventId = existing[0].id as string;
    await supabase
      .from("event_sources")
      .update({ event_id: existingEventId, match_status: "matched" })
      .eq("id", id);
    revalidatePath("/admin/review");
    revalidatePath("/admin");
    return { status: "merged", eventId: existingEventId };
  }

  // ── 主催者 find-or-create ────────────────────────────────────────────
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

  // ── 新規イベント作成（未公開）───────────────────────────────────────
  const confidence = typeof raw.confidence_score === "number" ? raw.confidence_score : null;
  const { data: newEvent } = await supabase
    .from("events")
    .insert({
      event_name: eventName,
      start_datetime: startDatetime,
      venue_name: venue,
      prefecture: prefecture,
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

  await supabase
    .from("event_sources")
    .update({ event_id: newEventId, match_status: "matched" })
    .eq("id", id);

  // ── ゲームタイトル登録 ─────────────────────────────────────────────
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
  return { status: "created", eventId: newEventId, enriched };
}
