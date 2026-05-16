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

type EnrichResult =
  | { ok: true; data: EnrichedFields }
  | { ok: false; reason: string };

async function enrichFromUrl(url: string): Promise<EnrichResult> {
  // ── フェッチ ─────────────────────────────────────────────────────
  let html: string;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      return { ok: false, reason: `URLの取得に失敗しました（HTTP ${resp.status}: ${resp.statusText}）` };
    }
    html = await resp.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `URLへの接続に失敗しました（${msg}）` };
  }

  // ── HTML → テキスト ────────────────────────────────────────────
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);

  if (!text) return { ok: false, reason: "ページからテキストを取得できませんでした" };

  // ── Claude で構造化抽出 ────────────────────────────────────────
  let claudeResult;
  try {
    claudeResult = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `以下はイベントページのテキストです。開催日時・会場・都道府県・主催者名を抽出して、必ずJSONのみを返してください（説明文・コードブロック不要）。

出力形式の例:
{"start_datetime":"2026-08-11T17:30:00+09:00","venue":"LINE CUBE SHIBUYA","prefecture":"東京都","organizer_name":"スパイク・チュンソフト"}

ルール:
- start_datetime は ISO 8601（+09:00 付き）。開演時刻が不明なら T00:00:00+09:00
- 情報がなければ null

テキスト:
${text}`,
      }],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `Claude APIの呼び出しに失敗しました（${msg}）` };
  }

  const block = claudeResult.content[0];
  if (block.type !== "text") return { ok: false, reason: "Claude から予期しない形式のレスポンスが返りました" };

  // ── JSON パース ────────────────────────────────────────────────
  const raw = block.text.trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, reason: `Claude がJSONを返しませんでした（応答: "${raw.slice(0, 100)}"）` };
  }

  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as EnrichedFields;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: `JSONの解析に失敗しました（${raw.slice(0, 100)}）` };
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

export async function approveSource(id: string, manualEnrichUrl?: string): Promise<ApproveResult> {
  const supabase = createAdminClient();

  const { data: source } = await supabase
    .from("event_sources")
    .select("raw_data, source_url, source_name")
    .eq("id", id)
    .single();

  if (!source) return { status: "error", message: "レコードが見つかりません" };

  const raw = source.raw_data as Record<string, unknown>;
  const eventName = typeof raw.title === "string" ? raw.title.trim() : null;
  let startDatetime = typeof raw.start_datetime === "string" ? raw.start_datetime : null;
  let venue = typeof raw.venue === "string" ? raw.venue : null;
  let prefecture = typeof raw.prefecture === "string" ? raw.prefecture : null;
  let organizerName = typeof raw.organizer_name === "string" ? raw.organizer_name.trim() : null;
  let enriched = false;

  // ── URL から補完（欠損フィールドを埋める）────────────────────────
  const tweetText = typeof raw._tweet_text === "string" ? raw._tweet_text : null;
  const autoUrls = tweetText ? extractExternalUrls(tweetText) : [];
  const urlToFetch = manualEnrichUrl || autoUrls[0];
  if (urlToFetch) {
    const enrichResult = await enrichFromUrl(urlToFetch);
    if (enrichResult.ok) {
      const fetched = enrichResult.data;
      if (fetched.start_datetime && !startDatetime) { startDatetime = fetched.start_datetime; enriched = true; }
      if (fetched.venue && !venue) venue = fetched.venue;
      if (fetched.prefecture && !prefecture) prefecture = fetched.prefecture;
      if (fetched.organizer_name && !organizerName) organizerName = fetched.organizer_name;
    } else if (!startDatetime) {
      return { status: "error", message: enrichResult.reason };
    }
  }

  if (!eventName) return { status: "error", message: "タイトルが取得できませんでした" };
  if (!startDatetime) return { status: "error", message: "日時を取得できませんでした。公式ページのURLがツイートに含まれているか確認してください" };

  // ── 複数会場チェック（1公演=1レコードルール） ────────────────────────
  const MULTI_SEPARATORS = ["・", "、", "，", "／"];
  const hasMultiPrefecture = prefecture && MULTI_SEPARATORS.some(s => prefecture!.includes(s));
  const hasMultiVenue = venue && MULTI_SEPARATORS.some(s => venue!.includes(s));
  if (hasMultiPrefecture || hasMultiVenue) {
    return {
      status: "error",
      message: "複数会場のツアーイベントです。CLAUDE.md「1公演=1レコード」ルールに従い、会場ごとに個別に登録してください。このソースは却下してください。",
    };
  }

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
