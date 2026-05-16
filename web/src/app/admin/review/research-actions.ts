"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SOCIAL_DOMAINS = ["x.com", "twitter.com", "t.co", "instagram.com", "facebook.com", "youtube.com", "youtu.be"];

type ResearchResult = {
  game_titles?: string[];
  start_time?: string | null;
  venue_name?: string | null;
  prefecture?: string | null;
  flyer_url?: string | null;
};

function isSocialUrl(url: string): boolean {
  return SOCIAL_DOMAINS.some((d) => url.includes(d));
}

function extractExternalUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s　-〿＀-￯、。！？「」【】（）[\]]+/g;
  const matches = text.match(urlRegex) ?? [];
  return matches.filter((url) => !SOCIAL_DOMAINS.some((d) => url.includes(d)));
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  } catch {
    return null;
  }
}

async function extractFromPage(pageText: string): Promise<ResearchResult> {
  const prompt = `以下はイベントページのテキストです。以下のJSON形式で情報を抽出してください。

ゲームタイトルは「最初にゲームとしてリリースされたタイトル」のみを含めてください（ビジュアルノベル含む。アニメ・漫画原作は除く）。シリーズ名で統一すること。

JSONのみ返してください：
{
  "game_titles": ["タイトル1", "タイトル2"],
  "start_time": "HH:MM または null",
  "venue_name": "会場名 または null",
  "prefecture": "都道府県名（例: 東京都）または null",
  "flyer_url": "フライヤー画像の直リンクURL または null"
}

テキスト:
${pageText}`;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const block = resp.content[0];
    if (block.type !== "text") return {};
    const match = block.text.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]) as ResearchResult;
  } catch {
    return {};
  }
}

async function uploadFlyer(
  supabase: ReturnType<typeof createAdminClient>,
  imageUrl: string,
  eventId: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const path = `${eventId}/flyer_researched.${ext}`;
    const { error } = await supabase.storage
      .from("event-images")
      .upload(path, buffer, { contentType, upsert: true });
    if (error) return null;
    return supabase.storage.from("event-images").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

async function callClaudeWithWebSearch(prompt: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }] as any[];
  const msgs: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let resultText = "";

  for (let i = 0; i < 8; i++) {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      tools,
      messages: msgs,
    });

    const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (textBlock) resultText = textBlock.text;
    if (resp.stop_reason === "end_turn") break;

    if (resp.stop_reason === "tool_use") {
      msgs.push({ role: "assistant", content: resp.content });
      const results = resp.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map(b => ({ type: "tool_result" as const, tool_use_id: b.id, content: "" }));
      if (results.length) msgs.push({ role: "user", content: results });
    } else {
      break;
    }
  }
  return resultText;
}

export async function reresearchEvent(
  id: string,
): Promise<{ ok: boolean; message: string; updatedFields?: string[] }> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select(`
      event_name, source_url, start_datetime,
      venue_name, prefecture, flyer_image_url, key_visual_url,
      organizers(name)
    `)
    .eq("id", id)
    .single();

  if (!event) return { ok: false, message: "イベントが見つかりません" };

  const organizer = (event.organizers as unknown as { name: string } | null)?.name ?? "";

  // ── Step 1: URL スクレイピング（公式・チケットサイトページを直接読む）────
  let parsed: ResearchResult = {};
  let scrapedFromUrl = false;

  // source_url がソーシャルでなければ直接スクレイピング
  let urlToScrape: string | null = null;
  if (event.source_url && !isSocialUrl(event.source_url)) {
    urlToScrape = event.source_url;
  } else {
    // X ツイートの場合: event_sources の raw_data._tweet_text から外部URLを抽出
    const { data: sources } = await supabase
      .from("event_sources")
      .select("raw_data")
      .eq("event_id", id)
      .limit(5);

    for (const src of (sources ?? [])) {
      const rawData = src.raw_data as Record<string, unknown>;
      const tweetText = typeof rawData._tweet_text === "string" ? rawData._tweet_text : null;
      if (tweetText) {
        const urls = extractExternalUrls(tweetText);
        if (urls.length > 0) {
          urlToScrape = urls[0];
          break;
        }
      }
    }
  }

  if (urlToScrape) {
    const pageText = await fetchPageText(urlToScrape);
    if (pageText) {
      parsed = await extractFromPage(pageText);
      scrapedFromUrl = true;
    }
  }

  // ── Step 2: ウェブ検索（スクレイピングで取れなかった情報を補完）──────────
  // ゲームタイトルが取れていない、またはスクレイピング自体できなかった場合
  const needsWebSearch = !parsed.game_titles?.length || !scrapedFromUrl;
  if (needsWebSearch) {
    const webPrompt = `コンサート「${event.event_name}」（主催: ${organizer}）について、X（Twitter）・公式サイト・プレスリリース等をウェブ検索し、以下の情報を収集してください。

ゲームタイトルは「最初にゲームとしてリリースされたタイトルのみ」（ビジュアルノベル含む。アニメ・漫画原作は除く）。

以下のJSON形式のみで返してください：
{
  "game_titles": ["タイトル1", "タイトル2"],
  "start_time": "HH:MM または null",
  "venue_name": "会場名 または null",
  "prefecture": "都道府県名（例: 東京都）または null",
  "flyer_url": "フライヤー画像の直リンクURL または null"
}`;

    try {
      const resultText = await callClaudeWithWebSearch(webPrompt);
      const match = resultText.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
      if (match) {
        const webResult = JSON.parse(match[0]) as ResearchResult;
        // スクレイピングで取れなかったフィールドをウェブ検索結果で補完
        if (!parsed.game_titles?.length && webResult.game_titles?.length) parsed.game_titles = webResult.game_titles;
        if (!parsed.start_time && webResult.start_time) parsed.start_time = webResult.start_time;
        if (!parsed.venue_name && webResult.venue_name) parsed.venue_name = webResult.venue_name;
        if (!parsed.prefecture && webResult.prefecture) parsed.prefecture = webResult.prefecture;
        if (!parsed.flyer_url && webResult.flyer_url) parsed.flyer_url = webResult.flyer_url;
      }
    } catch (err) {
      if (!scrapedFromUrl) {
        return { ok: false, message: `検索エラー: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  }

  // ── Step 3: 取得結果を DB に反映（欠損フィールドのみ更新）────────────────
  const updates: Record<string, unknown> = {};
  const updatedFields: string[] = [];

  if (parsed.venue_name && !event.venue_name) {
    updates.venue_name = parsed.venue_name;
    updatedFields.push("会場名");
  }
  if (parsed.prefecture && !event.prefecture) {
    updates.prefecture = parsed.prefecture;
    updatedFields.push("都道府県");
  }
  if (parsed.start_time && event.start_datetime) {
    const jst = new Date(new Date(event.start_datetime).getTime() + 9 * 60 * 60 * 1000);
    if (jst.getUTCHours() === 0 && jst.getUTCMinutes() === 0) {
      updates.start_datetime = `${event.start_datetime.substring(0, 10)}T${parsed.start_time}:00+09:00`;
      updatedFields.push("開催時間");
    }
  }
  if (parsed.flyer_url && !event.flyer_image_url && !event.key_visual_url) {
    const storedUrl = await uploadFlyer(supabase, parsed.flyer_url, id);
    if (storedUrl) {
      updates.flyer_image_url = storedUrl;
      updatedFields.push("フライヤー画像");
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("events").update(updates).eq("id", id);
    if (error) return { ok: false, message: error.message };
  }

  if (parsed.game_titles?.length) {
    const { data: existing } = await supabase
      .from("event_game_titles").select("id").eq("event_id", id).limit(1);
    if (!existing?.length) {
      for (const title of parsed.game_titles) {
        if (!title?.trim()) continue;
        const { data: gt } = await supabase
          .from("game_titles").select("id").eq("title_name", title).single();
        const gtId = gt?.id ?? (
          await supabase.from("game_titles").insert({ title_name: title }).select("id").single()
        ).data?.id;
        if (gtId) {
          await supabase.from("event_game_titles").insert({ event_id: id, game_title_id: gtId });
        }
      }
      updatedFields.push("ゲームタイトル");
    }
  }

  revalidatePath("/admin/review");
  return updatedFields.length
    ? { ok: true, message: `更新: ${updatedFields.join("、")}`, updatedFields }
    : { ok: true, message: "新しい情報は見つかりませんでした" };
}
