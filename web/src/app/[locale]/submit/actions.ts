"use server";

import { createAdminClient } from "@/utils/supabase/admin";

type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitEvent(formData: FormData): Promise<SubmitResult> {
  // honeypot
  if (formData.get("website")) return { ok: false, error: "invalid" };

  const eventName = (formData.get("event_name") as string | null)?.trim();
  const date = (formData.get("date") as string | null)?.trim();
  const time = (formData.get("time") as string | null)?.trim();
  const venue = (formData.get("venue") as string | null)?.trim();
  const prefecture = (formData.get("prefecture") as string | null)?.trim();
  const organizerName = (formData.get("organizer_name") as string | null)?.trim();
  const ticketUrl = (formData.get("ticket_url") as string | null)?.trim() || null;
  const officialUrl = (formData.get("official_url") as string | null)?.trim() || null;
  const gameTitlesRaw = (formData.get("game_titles") as string | null)?.trim() || "";
  const email = (formData.get("email") as string | null)?.trim();
  const notes = (formData.get("notes") as string | null)?.trim() || null;

  if (!eventName || !date || !venue || !prefecture || !organizerName || !email) {
    return { ok: false, error: "必須項目が入力されていません" };
  }

  const startDatetime = time ? `${date}T${time}:00+09:00` : `${date}T00:00:00+09:00`;
  const gameTitles = gameTitlesRaw
    ? gameTitlesRaw.split(/[,、，]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const rawData = {
    title: eventName,
    start_datetime: startDatetime,
    venue,
    prefecture,
    organizer_name: organizerName,
    ticket_url: ticketUrl,
    organizer_official_url: officialUrl,
    game_titles: gameTitles,
    description: notes,
    _submitter_email: email,
    source_rank: "C",
    confidence_score: 80,
  };

  const sourceUrl = `submission:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("event_sources").insert({
      source_url: sourceUrl,
      source_name: "submission",
      raw_data: rawData,
      match_status: "review_needed",
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("[submit]", e);
    return { ok: false, error: "送信に失敗しました。しばらく経ってから再試行してください。" };
  }
}
