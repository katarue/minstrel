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
  organizer_name?: string | null;
};

function isSocialUrl(url: string): boolean {
  return SOCIAL_DOMAINS.some((d) => url.includes(d));
}

function extractExternalUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s　-〿＀-￯、。！？「」【】（）[\]]+/g;
  const matches = text.match(urlRegex) ?? [];
  return matches.filter((url) => !SOCIAL_DOMAINS.some((d) => url.includes(d)));
}

function getTweetId(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}

function detectStartTimes(html: string): string[] {
  const times: string[] = [];
  const regex = /(\d{2}:\d{2})\s*開演/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (!times.includes(m[1])) times.push(m[1]);
  }
  return times.sort();
}

async function fetchPageData(url: string): Promise<{ text: string; startTimes: string[] } | null> {
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
    // タグ削除前に og:image URL を抽出して保持する
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const ogImage = ogImageMatch?.[1] ?? null;

    // itemprop 構造化データをタグ削除前に抽出（Peatix 等の meta タグ形式に対応）
    const structuredParts: string[] = [];
    const venueMatch =
      html.match(/itemprop="location"[\s\S]{0,600}?<meta[^>]+content="([^"]+)"[^>]*itemprop="name"/i) ??
      html.match(/itemprop="location"[\s\S]{0,600}?itemprop="name"[^>]*content="([^"]+)"/i);
    if (venueMatch?.[1]) structuredParts.push(`会場: ${venueMatch[1]}`);
    const organizerMatch =
      html.match(/itemprop="organizer"[\s\S]{0,600}?<meta[^>]+content="([^"]+)"[^>]*itemprop="name"/i) ??
      html.match(/itemprop="organizer"[\s\S]{0,600}?itemprop="name"[^>]*content="([^"]+)"/i);
    if (organizerMatch?.[1]) structuredParts.push(`主催者: ${organizerMatch[1]}`);
    // Peatix: Twitter シェア URL からオーガナイザーの Peatix アカウント名を抽出
    if (!organizerMatch) {
      const peatixOrgMatch = html.match(/https?%3A%2F%2F([a-zA-Z0-9][a-zA-Z0-9\-]+)\.peatix\.com/i);
      if (peatixOrgMatch?.[1]) structuredParts.push(`主催者(Peatixアカウント): ${peatixOrgMatch[1]}`);
    }
    // Peatix: keywords メタタグからオーガナイザーアカウント名を抽出（イベント名の直後の項目）
    if (structuredParts.every(p => !p.startsWith("主催者"))) {
      const kwMatch = html.match(/<meta[^>]+name="keywords"[^>]+content="([^"]+)"/i)
        ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+name="keywords"/i);
      if (kwMatch?.[1]) {
        // Peatix keywords: [カテゴリ,...,イベント名,オーガナイザー名,チケットの販,...]
        // "チケットの販" の直前の項目がオーガナイザーユーザー名
        const kwList = kwMatch[1].split(",").map(s => s.trim());
        const genericIdx = kwList.findIndex(k => k.startsWith("チケット") || k === "イベント管理");
        if (genericIdx > 1) {
          const candidate = kwList[genericIdx - 1];
          if (candidate && candidate.length < 50) {
            structuredParts.push(`主催者(Peatixアカウント): ${candidate}`);
          }
        }
      }
    }

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
    const startTimes = detectStartTimes(html);
    const prefix = structuredParts.length ? structuredParts.join("\n") + "\n\n" : "";
    const fullText = ogImage ? `${prefix}${text}\n\nog:image: ${ogImage}` : `${prefix}${text}`;
    return { text: fullText, startTimes };
  } catch {
    return null;
  }
}

async function fetchPageText(url: string): Promise<string | null> {
  return (await fetchPageData(url))?.text ?? null;
}

// ── twitterapi.io でリプライ・会話ツリーのテキストを取得 ─────────────────────
async function fetchTweetReplies(tweetId: string): Promise<string[]> {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      query: `conversation_id:${tweetId} -is:retweet`,
      queryType: "Latest",
    });
    const res = await fetch(
      `https://api.twitterapi.io/twitter/tweet/advanced_search?${params}`,
      { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return [];

    const data = await res.json() as { tweets?: Record<string, unknown>[] };
    return (data.tweets ?? [])
      .filter((t) => typeof t.text === "string")
      .map((t) => t.text as string);
  } catch {
    return [];
  }
}

// ── twitterapi.io でツイートIDから画像URLを直接取得 ──────────────────────────
async function fetchTweetImage(tweetId: string): Promise<string | null> {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.twitterapi.io/twitter/tweets?tweet_ids=${tweetId}`,
      { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return null;

    const data = await res.json() as { tweets?: Record<string, unknown>[] };
    const tweet = (data.tweets ?? [])[0];
    if (!tweet) return null;

    if (Array.isArray(tweet.photos)) {
      const first = (tweet.photos as Record<string, unknown>[])[0];
      const url = (first?.url ?? first?.media_url_https ?? first?.media_url) as string | undefined;
      if (url) return url;
    }
    const mediaArr =
      (tweet.extended_entities as Record<string, unknown> | undefined)?.media ??
      (tweet.extendedEntities as Record<string, unknown> | undefined)?.media ??
      (tweet.entities as Record<string, unknown> | undefined)?.media;
    if (Array.isArray(mediaArr)) {
      for (const m of mediaArr as Record<string, unknown>[]) {
        if (m.type === "photo") {
          const url = (m.media_url_https ?? m.media_url) as string | undefined;
          if (url) return url;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function extractFromPage(pageText: string): Promise<ResearchResult> {
  const prompt = `以下はイベントページまたはリプライのテキストです。以下のJSON形式で情報を抽出してください。

ゲームタイトルは「最初にゲームとしてリリースされたタイトル」のみを含めてください（ビジュアルノベル含む。アニメ・漫画原作は除く）。シリーズ名で統一すること。

JSONのみ返してください：
{
  "game_titles": ["タイトル1", "タイトル2"],
  "start_time": "HH:MM または null",
  "venue_name": "会場名 または null",
  "prefecture": "都道府県名（例: 東京都）または null",
  "flyer_url": "フライヤー画像の直リンクURL または null",
  "organizer_name": "主催者・団体名 または null"
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

    // 複数テキストブロックがある場合（前置き + JSON）、最後のブロックが JSON
    const textBlock = [...resp.content].reverse().find((b): b is Anthropic.TextBlock => b.type === "text");
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
  overrideUrl?: string,
): Promise<{ ok: boolean; message: string; updatedFields?: string[] }> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select(`
      event_name, source_url, start_datetime,
      venue_name, prefecture, flyer_image_url, key_visual_url,
      organizer_id, reference_url, description,
      source_rank, is_canceled, is_published,
      auto_publish_eligible, organizers(name)
    `)
    .eq("id", id)
    .single();

  if (!event) return { ok: false, message: "イベントが見つかりません" };

  const organizer = (event.organizers as unknown as { name: string } | null)?.name ?? "";
  const effectiveUrl = overrideUrl?.trim() || event.source_url;
  let parsed: ResearchResult = {};

  // ── Step 1a: チケットサイト・公式ページを直接スクレイピング ───────────────
  let scrapedFromUrl = false;
  let mainStartTimes: string[] = [];
  let mainPageData: Awaited<ReturnType<typeof fetchPageData>> = null;
  if (effectiveUrl && !isSocialUrl(effectiveUrl)) {
    mainPageData = await fetchPageData(effectiveUrl);
    if (mainPageData) {
      parsed = await extractFromPage(mainPageData.text);
      mainStartTimes = mainPageData.startTimes;
      scrapedFromUrl = true;
    }
  }

  // 構造化プレフィックスから主催者を直接補完（Claudeが抽出できなかった場合）
  if (!parsed.organizer_name && mainPageData) {
    const orgLine = mainPageData.text.match(/^主催者[^:\n]*:\s*(.+)$/m);
    if (orgLine?.[1]) parsed.organizer_name = orgLine[1].trim();
  }
  // Peatixアカウント名（英小文字・数字のみ）かどうかを記録しウェブ検索で正式名称を補完する
  const organizerIsUsername = parsed.organizer_name ? /^[a-z0-9][a-z0-9\-]+$/.test(parsed.organizer_name) : false;

  // ── Step 1b: X ツイートの場合は複数の補助情報を並列取得 ─────────────────
  if (effectiveUrl && isSocialUrl(effectiveUrl)) {
    const tweetId = getTweetId(effectiveUrl);

    // ツイート本文内の外部URL → 公式ページスクレイピング
    let externalUrlText: string | null = null;
    const { data: sources } = await supabase
      .from("event_sources")
      .select("raw_data")
      .eq("event_id", id)
      .limit(5);

    const tweetUrls: string[] = [];
    for (const src of (sources ?? [])) {
      const rawData = src.raw_data as Record<string, unknown>;
      const tweetText = typeof rawData._tweet_text === "string" ? rawData._tweet_text : null;
      if (tweetText) {
        tweetUrls.push(...extractExternalUrls(tweetText));
      }
    }

    // リプライ取得 + 外部URLスクレイピングを並列実行
    const [replyTexts, externalPage] = await Promise.all([
      tweetId ? fetchTweetReplies(tweetId) : Promise.resolve([]),
      tweetUrls[0] ? fetchPageText(tweetUrls[0]) : Promise.resolve(null),
    ]);

    externalUrlText = externalPage;

    // 公式ページから抽出（外部URLがあれば最優先）
    if (externalUrlText) {
      parsed = await extractFromPage(externalUrlText);
      scrapedFromUrl = true;
    }

    // リプライのテキストから補完（ゲームタイトル・会場が未取得の場合）
    if (replyTexts.length > 0 && (!parsed.game_titles?.length || !parsed.venue_name)) {
      const replyText = replyTexts.join("\n").slice(0, 4000);
      const replyResult = await extractFromPage(replyText);
      if (!parsed.game_titles?.length && replyResult.game_titles?.length) {
        parsed.game_titles = replyResult.game_titles;
      }
      if (!parsed.venue_name && replyResult.venue_name) parsed.venue_name = replyResult.venue_name;
      if (!parsed.prefecture && replyResult.prefecture) parsed.prefecture = replyResult.prefecture;
      if (!parsed.start_time && replyResult.start_time) parsed.start_time = replyResult.start_time;
    }
  }

  // ── Step 1c: reference_url からも画像・情報を補完 ─────────────────────────
  if (event.reference_url) {
    if (isSocialUrl(event.reference_url)) {
      const refTweetId = getTweetId(event.reference_url);
      if (refTweetId) {
        const [tweetImage, refTexts] = await Promise.all([
          fetchTweetImage(refTweetId),
          fetchTweetReplies(refTweetId),
        ]);
        if (tweetImage && !parsed.flyer_url) parsed.flyer_url = tweetImage;
        if (refTexts.length > 0) {
          const refText = refTexts.join("\n").slice(0, 4000);
          const refResult = await extractFromPage(refText);
          if (!parsed.game_titles?.length && refResult.game_titles?.length) parsed.game_titles = refResult.game_titles;
          if (!parsed.venue_name && refResult.venue_name) parsed.venue_name = refResult.venue_name;
          if (!parsed.prefecture && refResult.prefecture) parsed.prefecture = refResult.prefecture;
          if (!parsed.organizer_name && refResult.organizer_name) parsed.organizer_name = refResult.organizer_name;
          if (!parsed.start_time && refResult.start_time) parsed.start_time = refResult.start_time;
        }
      }
    } else {
      const refText = await fetchPageText(event.reference_url);
      if (refText) {
        const refResult = await extractFromPage(refText);
        if (!parsed.game_titles?.length && refResult.game_titles?.length) parsed.game_titles = refResult.game_titles;
        if (!parsed.venue_name && refResult.venue_name) parsed.venue_name = refResult.venue_name;
        if (!parsed.prefecture && refResult.prefecture) parsed.prefecture = refResult.prefecture;
        if (!parsed.organizer_name && refResult.organizer_name) parsed.organizer_name = refResult.organizer_name;
        if (!parsed.flyer_url && refResult.flyer_url) parsed.flyer_url = refResult.flyer_url;
      }
    }
  }

  // ── Step 2: ウェブ検索（スクレイピングで取れなかった情報を補完）──────────
  // organizerIsUsernameの場合もウェブ検索で正式名称を取得する
  const needsWebSearch = !parsed.game_titles?.length || !scrapedFromUrl || !parsed.organizer_name || organizerIsUsername;
  if (needsWebSearch) {
    const orgHint = organizerIsUsername && parsed.organizer_name ? `（Peatixアカウント: ${parsed.organizer_name}）` : "";
    const webPrompt = `コンサート「${event.event_name}」${orgHint}（主催: ${organizer}）について、X（Twitter）・公式サイト・プレスリリース等をウェブ検索し、以下の情報を収集してください。

ゲームタイトルは「最初にゲームとしてリリースされたタイトルのみ」（ビジュアルノベル含む。アニメ・漫画原作は除く）。

以下のJSON形式のみで返してください：
{
  "game_titles": ["タイトル1", "タイトル2"],
  "start_time": "HH:MM または null",
  "venue_name": "会場名 または null",
  "prefecture": "都道府県名（例: 東京都）または null",
  "organizer_name": "主催者・団体名 または null"
}`;

    try {
      const resultText = await callClaudeWithWebSearch(webPrompt);
      const match = resultText.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
      if (match) {
        const webResult = JSON.parse(match[0]) as ResearchResult;
        if (!parsed.game_titles?.length && webResult.game_titles?.length) parsed.game_titles = webResult.game_titles;
        if (!parsed.start_time && webResult.start_time) parsed.start_time = webResult.start_time;
        if (!parsed.venue_name && webResult.venue_name) parsed.venue_name = webResult.venue_name;
        if (!parsed.prefecture && webResult.prefecture) parsed.prefecture = webResult.prefecture;
        // ユーザー名スタイル（hibiyamusicfes等）よりウェブ検索の正式名称を優先
        if (webResult.organizer_name && (!parsed.organizer_name || organizerIsUsername)) {
          parsed.organizer_name = webResult.organizer_name;
        }
      }
    } catch (err) {
      if (!scrapedFromUrl && !parsed.game_titles?.length) {
        return { ok: false, message: `検索エラー: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  }

  // ── Step 3: 取得結果を DB に反映（欠損フィールドのみ更新）────────────────
  const updates: Record<string, unknown> = {};
  const updatedFields: string[] = [];

  // URLが上書き指定された場合は source_url を更新
  if (overrideUrl?.trim() && overrideUrl.trim() !== event.source_url) {
    updates.source_url = overrideUrl.trim();
    updatedFields.push("ソースURL");
  }

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
  if (parsed.organizer_name && !event.organizer_id) {
    const { data: existingOrg } = await supabase
      .from("organizers")
      .select("id")
      .eq("name", parsed.organizer_name)
      .single();
    const orgId = existingOrg?.id ?? (
      await supabase.from("organizers").insert({ name: parsed.organizer_name }).select("id").single()
    ).data?.id;
    if (orgId) {
      updates.organizer_id = orgId;
      updatedFields.push("主催者");
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("events").update(updates).eq("id", id);
    if (error) return { ok: false, message: error.message };
  }

  if (parsed.game_titles?.length) {
    const { data: existing } = await supabase
      .from("event_game_titles").select("event_id").eq("event_id", id).limit(1);
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

  // ── Step 4: 複数公演を検出した場合、レコードを分割 ─────────────────────────
  // 既にイベント名末尾に時刻が付いている場合はスキップ（二重分割防止）
  if (mainStartTimes.length >= 2 && !/\s\d{2}:\d{2}$/.test(event.event_name)) {
    const [time1, time2] = mainStartTimes;
    const dateStr = event.start_datetime?.substring(0, 10); // "2026-05-17"

    // 元レコードを1公演目で更新
    await supabase.from("events").update({
      event_name: `${event.event_name} ${time1}`,
      start_datetime: dateStr ? `${dateStr}T${time1}:00+09:00` : event.start_datetime,
    }).eq("id", id);

    // 2公演目を新規レコードとして挿入（更新済み値を優先してコピー）
    const { data: newEvent } = await supabase.from("events").insert({
      event_name: `${event.event_name} ${time2}`,
      source_url: (updates.source_url as string | undefined) ?? event.source_url,
      start_datetime: dateStr ? `${dateStr}T${time2}:00+09:00` : event.start_datetime,
      venue_name: (updates.venue_name as string | undefined) ?? event.venue_name,
      prefecture: (updates.prefecture as string | undefined) ?? event.prefecture,
      flyer_image_url: (updates.flyer_image_url as string | undefined) ?? event.flyer_image_url,
      key_visual_url: event.key_visual_url,
      organizer_id: (updates.organizer_id as string | undefined) ?? event.organizer_id,
      reference_url: event.reference_url,
      description: event.description,
      source_rank: event.source_rank,
      is_canceled: false,
      is_published: false,
      auto_publish_eligible: false,
    }).select("id").single();

    // ゲームタイトルを新レコードにコピー
    if (newEvent?.id) {
      const { data: existingGts } = await supabase
        .from("event_game_titles").select("game_title_id").eq("event_id", id);
      for (const gt of (existingGts ?? [])) {
        await supabase.from("event_game_titles").upsert({
          event_id: newEvent.id,
          game_title_id: gt.game_title_id,
        });
      }
    }

    revalidatePath("/admin/review");
    return { ok: true, message: `2公演に分割しました（${time1} / ${time2}）` };
  }

  revalidatePath("/admin/review");
  return updatedFields.length
    ? { ok: true, message: `更新: ${updatedFields.join("、")}`, updatedFields }
    : { ok: true, message: "新しい情報は見つかりませんでした" };
}

type IngestExtraction = {
  event_name?: string;
  start_datetime?: string | null;
  venue_name?: string | null;
  prefecture?: string | null;
  organizer_name?: string | null;
  organizer_official_url?: string | null;
  ticket_url?: string | null;
  description?: string | null;
  game_titles?: string[];
  is_game_music_event?: boolean;
};

async function extractFullEvent(pageText: string, sourceUrl: string): Promise<IngestExtraction> {
  const prompt = `以下はコンサートページのテキストです。JSONのみ返してください。

抽出ルール:
- game_titles: ゲームが最初の発表媒体のタイトルのみ（アニメ・漫画・映画原作は除く）。シリーズ名で統一。
- start_datetime: ISO8601形式（JST）。不明な場合はnull。
- prefecture: 都道府県名（例: 東京都）。会場住所から推定。不明はnull。
- organizer_official_url: 主催者・演奏団体の公式サイトURL（チケットサイト・SNSは除く）。

出典URL: ${sourceUrl}

{
  "event_name": "string",
  "start_datetime": "ISO8601 or null",
  "venue_name": "string or null",
  "prefecture": "string or null",
  "organizer_name": "string or null",
  "organizer_official_url": "string or null",
  "ticket_url": "string or null",
  "description": "100〜200字の日本語要約 or null",
  "game_titles": ["タイトル1"],
  "is_game_music_event": true
}

テキスト:
${pageText}`;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const block = resp.content[0];
    if (block.type !== "text") return {};
    const match = block.text.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]) as IngestExtraction;
  } catch {
    return {};
  }
}

export async function ingestFromUrl(
  url: string,
): Promise<{ ok: boolean; message: string; eventId?: string }> {
  const supabase = createAdminClient();
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return { ok: false, message: "URLを入力してください" };
  }

  // 重複チェック
  const { data: existing } = await supabase
    .from("event_sources")
    .select("event_id")
    .eq("source_url", trimmedUrl)
    .limit(1);

  if (existing?.length) {
    return { ok: false, message: "このURLは既に登録済みです" };
  }

  // ページ取得
  const pageData = await fetchPageData(trimmedUrl);
  if (!pageData) {
    return { ok: false, message: "ページの取得に失敗しました（URLを確認してください）" };
  }

  // Claude で全フィールド抽出
  const extracted = await extractFullEvent(pageData.text, trimmedUrl);

  if (!extracted.event_name) {
    return { ok: false, message: "イベント名を抽出できませんでした" };
  }

  // 主催者の upsert
  let organizerId: string | null = null;
  if (extracted.organizer_name) {
    const { data: existingOrg } = await supabase
      .from("organizers")
      .select("id")
      .eq("name", extracted.organizer_name)
      .single();
    organizerId = existingOrg?.id ?? (
      await supabase.from("organizers").insert({
        name: extracted.organizer_name,
        official_url: extracted.organizer_official_url ?? null,
      }).select("id").single()
    ).data?.id ?? null;
  }

  // イベント挿入
  const { data: newEvent, error: insertError } = await supabase
    .from("events")
    .insert({
      event_name: extracted.event_name,
      start_datetime: extracted.start_datetime ?? null,
      venue_name: extracted.venue_name ?? null,
      prefecture: extracted.prefecture ?? null,
      organizer_id: organizerId,
      official_url: extracted.organizer_official_url ?? null,
      ticket_url: extracted.ticket_url ?? null,
      source_url: trimmedUrl,
      description: extracted.description ?? null,
      source_rank: "A",
      is_published: false,
      auto_publish_eligible: false,
      is_canceled: false,
    })
    .select("id")
    .single();

  if (insertError || !newEvent) {
    return { ok: false, message: `登録エラー: ${insertError?.message ?? "不明なエラー"}` };
  }

  // event_sources 挿入
  await supabase.from("event_sources").insert({
    event_id: newEvent.id,
    source_url: trimmedUrl,
    source_name: "manual_ingest",
    match_status: "new",
  });

  // ゲームタイトル挿入
  for (const title of (extracted.game_titles ?? [])) {
    if (!title?.trim()) continue;
    const { data: gt } = await supabase
      .from("game_titles").select("id").eq("title_name", title).single();
    const gtId = gt?.id ?? (
      await supabase.from("game_titles").insert({ title_name: title }).select("id").single()
    ).data?.id;
    if (gtId) {
      await supabase.from("event_game_titles").insert({ event_id: newEvent.id, game_title_id: gtId });
    }
  }

  revalidatePath("/admin/review");
  return { ok: true, message: `「${extracted.event_name}」を登録しました`, eventId: newEvent.id };
}
