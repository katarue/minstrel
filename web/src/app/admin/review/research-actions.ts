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
    // タグ削除前に og:image URL を抽出して保持する
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const ogImage = ogImageMatch?.[1] ?? null;

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
    return ogImage ? `${text}\n\nog:image: ${ogImage}` : text;
  } catch {
    return null;
  }
}

// ── twitterapi.io でリプライ・会話ツリーを取得 ─────────────────────────────
type TweetReplyData = {
  texts: string[];
  imageUrls: string[];
};

async function fetchTweetReplies(tweetId: string): Promise<TweetReplyData> {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  if (!apiKey) return { texts: [], imageUrls: [] };

  try {
    const params = new URLSearchParams({
      query: `conversation_id:${tweetId} -is:retweet`,
      queryType: "Latest",
    });
    const res = await fetch(
      `https://api.twitterapi.io/twitter/tweet/advanced_search?${params}`,
      {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return { texts: [], imageUrls: [] };

    const data = await res.json() as { tweets?: Record<string, unknown>[] };
    const texts: string[] = [];
    const imageUrls: string[] = [];

    for (const tweet of (data.tweets ?? [])) {
      if (typeof tweet.text === "string") texts.push(tweet.text);

      // twitterapi.io は snake_case で返すため extended_entities と entities の両方を確認
      const mediaArr =
        (tweet.extended_entities as Record<string, unknown> | undefined)?.media ??
        (tweet.extendedEntities as Record<string, unknown> | undefined)?.media ??
        (tweet.entities as Record<string, unknown> | undefined)?.media;
      if (Array.isArray(mediaArr)) {
        for (const m of mediaArr as Record<string, unknown>[]) {
          if (m.type === "photo") {
            const url = (m.media_url_https ?? m.media_url) as string | undefined;
            if (url) imageUrls.push(url);
          }
        }
      }
    }

    return { texts, imageUrls };
  } catch {
    return { texts: [], imageUrls: [] };
  }
}

// ツイートオブジェクトから画像URLを抽出する共通ヘルパー
function extractImagesFromTweet(tweet: Record<string, unknown>): string[] {
  const urls: string[] = [];

  // パターン1: photos[] フィールド（twitterapi.io 独自）
  if (Array.isArray(tweet.photos)) {
    for (const photo of tweet.photos as Record<string, unknown>[]) {
      const url = (photo.url ?? photo.media_url_https ?? photo.media_url) as string | undefined;
      if (url) urls.push(url);
    }
  }

  // パターン2: extended_entities / entities の media[]（標準 Twitter API 形式）
  const mediaArr =
    (tweet.extended_entities as Record<string, unknown> | undefined)?.media ??
    (tweet.extendedEntities as Record<string, unknown> | undefined)?.media ??
    (tweet.entities as Record<string, unknown> | undefined)?.media;

  if (Array.isArray(mediaArr)) {
    for (const m of mediaArr as Record<string, unknown>[]) {
      if (m.type === "photo") {
        const url = (m.media_url_https ?? m.media_url) as string | undefined;
        if (url && !urls.includes(url)) urls.push(url);
      }
    }
  }

  return urls;
}

async function fetchOriginalTweetImages(tweetId: string, tweetUrl?: string): Promise<string[]> {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  if (!apiKey) return [];

  try {
    // 方法1: 単一ツイート取得エンドポイント
    const res = await fetch(
      `https://api.twitterapi.io/twitter/tweet?tweet_id=${tweetId}`,
      { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(10000) },
    );
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as any;
      const tweet = data.tweet ?? data.data ?? (
        typeof data === "object" && !Array.isArray(data) && !data.tweets ? data : null
      );
      if (tweet) {
        const images = extractImagesFromTweet(tweet as Record<string, unknown>);
        if (images.length > 0) return images;
      }
    }

    // 方法2: 会話検索で元ツイートを探す
    const searchParams = new URLSearchParams({
      query: `conversation_id:${tweetId} -is:retweet`,
      queryType: "Latest",
    });
    const res2 = await fetch(
      `https://api.twitterapi.io/twitter/tweet/advanced_search?${searchParams}`,
      { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(10000) },
    );
    if (res2.ok) {
      const data2 = await res2.json() as { tweets?: Record<string, unknown>[] };
      for (const tweet of (data2.tweets ?? [])) {
        // id_str を優先（ツイートIDはJSの安全整数上限を超えるため数値は精度ロスする）
        const id = (tweet.id_str ?? String(tweet.id)) as string | undefined;
        if (id === tweetId) {
          const images = extractImagesFromTweet(tweet);
          if (images.length > 0) return images;
        }
      }
    }

    // 方法3: from:ハンドル + スノーフレークIDから逆算した日付範囲で検索
    const handleMatch = tweetUrl?.match(/x\.com\/([^/]+)\/status/);
    const handle = handleMatch?.[1];
    if (handle) {
      const snowflake = BigInt(tweetId);
      const timestampMs = Number(snowflake >> BigInt(22)) + 1288834974657;
      const sinceTs = Math.floor((timestampMs - 3600000) / 1000);
      const untilTs = Math.floor((timestampMs + 86400000) / 1000);
      const params3 = new URLSearchParams({
        query: `from:${handle} since_time:${sinceTs} until_time:${untilTs} -is:retweet`,
        queryType: "Latest",
      });
      const res3 = await fetch(
        `https://api.twitterapi.io/twitter/tweet/advanced_search?${params3}`,
        { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(10000) },
      );
      if (res3.ok) {
        const data3 = await res3.json() as { tweets?: Record<string, unknown>[] };
        for (const tweet of (data3.tweets ?? [])) {
          const id = (tweet.id_str ?? String(tweet.id)) as string | undefined;
          if (id === tweetId) {
            const images = extractImagesFromTweet(tweet);
            if (images.length > 0) return images;
          }
        }
      }
    }

    return [];
  } catch {
    return [];
  }
}

// og:image を HTML から直接抽出（twitterapi.io が失敗した場合のフォールバック）
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function analyzeImageWithVision(imageUrl: string): Promise<ResearchResult> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return {};
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const base64 = buffer.toString("base64");

    const mediaType = (
      contentType.startsWith("image/png")  ? "image/png"  :
      contentType.startsWith("image/gif")  ? "image/gif"  :
      contentType.startsWith("image/webp") ? "image/webp" : "image/jpeg"
    ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text: `このイベントフライヤー画像から、以下の情報をJSON形式で抽出してください。

ゲームタイトルは「最初にゲームとしてリリースされたタイトル」のみ（ビジュアルノベル含む。アニメ・漫画原作は除く）。

JSONのみ返してください：
{
  "game_titles": ["タイトル1", "タイトル2"],
  "start_time": "HH:MM または null",
  "venue_name": "会場名 または null",
  "prefecture": "都道府県名（例: 東京都）または null",
  "flyer_url": null,
  "organizer_name": "主催者・団体名 または null"
}`,
          },
        ],
      }],
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
  overrideUrl?: string,
): Promise<{ ok: boolean; message: string; updatedFields?: string[] }> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select(`
      event_name, source_url, start_datetime,
      venue_name, prefecture, flyer_image_url, key_visual_url,
      organizer_id, reference_url, organizers(name)
    `)
    .eq("id", id)
    .single();

  if (!event) return { ok: false, message: "イベントが見つかりません" };

  const organizer = (event.organizers as unknown as { name: string } | null)?.name ?? "";
  const effectiveUrl = overrideUrl?.trim() || event.source_url;
  let parsed: ResearchResult = {};
  let allImageUrls: string[] = [];

  // ── Step 1a: チケットサイト・公式ページを直接スクレイピング ───────────────
  let scrapedFromUrl = false;
  if (effectiveUrl && !isSocialUrl(effectiveUrl)) {
    const pageText = await fetchPageText(effectiveUrl);
    if (pageText) {
      parsed = await extractFromPage(pageText);
      scrapedFromUrl = true;
    }
  }

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

    // リプライ取得 + 元ツイート画像取得 + 外部URLスクレイピングを並列実行
    const [replyData, originalImages, externalPage] = await Promise.all([
      tweetId ? fetchTweetReplies(tweetId) : Promise.resolve({ texts: [], imageUrls: [] }),
      tweetId ? fetchOriginalTweetImages(tweetId, effectiveUrl) : Promise.resolve([]),
      tweetUrls[0] ? fetchPageText(tweetUrls[0]) : Promise.resolve(null),
    ]);

    allImageUrls = [...originalImages];
    // API で画像取得できない場合は og:image をフォールバック
    if (originalImages.length === 0 && tweetId) {
      const ogImg = await fetchOgImage(effectiveUrl);
      if (ogImg) allImageUrls.push(ogImg);
    }
    externalUrlText = externalPage;

    // 公式ページから抽出（外部URLがあれば最優先）
    if (externalUrlText) {
      parsed = await extractFromPage(externalUrlText);
      scrapedFromUrl = true;
    }

    // リプライのテキストから補完（ゲームタイトル・会場が未取得の場合）
    if (replyData.texts.length > 0 && (!parsed.game_titles?.length || !parsed.venue_name)) {
      const replyText = replyData.texts.join("\n").slice(0, 4000);
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
        const [refImages, refReplies] = await Promise.all([
          fetchOriginalTweetImages(refTweetId, event.reference_url),
          fetchTweetReplies(refTweetId),
        ]);
        allImageUrls.push(...refImages);
        // API で画像取得できない場合は og:image をフォールバック
        if (refImages.length === 0) {
          const ogImg = await fetchOgImage(event.reference_url);
          if (ogImg) allImageUrls.push(ogImg);
        }
        if (refReplies.texts.length > 0) {
          const refText = refReplies.texts.join("\n").slice(0, 4000);
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
  "flyer_url": "フライヤー画像の直リンクURL または null",
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
        if (!parsed.flyer_url && webResult.flyer_url) parsed.flyer_url = webResult.flyer_url;
      }
    } catch (err) {
      if (!scrapedFromUrl && !parsed.game_titles?.length) {
        return { ok: false, message: `検索エラー: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
  }

  // ── Step 2.5: Vision OCR（X フライヤー画像から不足フィールドを補完）────────
  if (allImageUrls.length > 0 && (!parsed.venue_name || !parsed.prefecture || !parsed.organizer_name)) {
    for (const imgUrl of allImageUrls.slice(0, 3)) {
      const visionResult = await analyzeImageWithVision(imgUrl);
      if (!parsed.game_titles?.length && visionResult.game_titles?.length) parsed.game_titles = visionResult.game_titles;
      if (!parsed.start_time && visionResult.start_time) parsed.start_time = visionResult.start_time;
      if (!parsed.venue_name && visionResult.venue_name) parsed.venue_name = visionResult.venue_name;
      if (!parsed.prefecture && visionResult.prefecture) parsed.prefecture = visionResult.prefecture;
      if (!parsed.organizer_name && visionResult.organizer_name) parsed.organizer_name = visionResult.organizer_name;
      if (parsed.venue_name && parsed.prefecture && parsed.organizer_name) break;
    }
  }
  if (allImageUrls.length > 0 && !parsed.flyer_url) {
    parsed.flyer_url = allImageUrls[0];
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
