"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export type CalendarEvent = {
  id: string;
  tour_id: string | null;
  event_name: string;
  event_name_en: string | null;
  start_datetime: string;
  venue_name: string | null;
  prefecture: string | null;
};

/**
 * 指定月（YYYY-MM）の公開済みイベントを取得する。
 * トップページのカレンダーセクションが月切り替え時にページ遷移なしで呼び出す。
 */
export async function getCalendarMonth(monthStr: string): Promise<CalendarEvent[]> {
  const m = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!m) return [];
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10); // 1-indexed

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("events")
    .select("id, tour_id, event_name, event_name_en, start_datetime, venue_name, prefecture")
    .eq("is_published", true)
    .gte("start_datetime", new Date(Date.UTC(year, month - 1, 1)).toISOString())
    .lt("start_datetime", new Date(Date.UTC(year, month, 1)).toISOString())
    .order("start_datetime", { ascending: true });

  if (error) {
    console.error("[calendarActions] getCalendarMonth error:", error);
    return [];
  }
  return (data ?? []) as CalendarEvent[];
}
