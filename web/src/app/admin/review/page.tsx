import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { ReviewQueue } from "./ReviewQueue";
import { RecordList, type EventRecord } from "./RecordList";

export const revalidate = 0;
export const maxDuration = 60;

type RawData = {
  title?: string | null;
  start_datetime?: string | null;
  venue?: string | null;
  prefecture?: string | null;
  organizer_name?: string | null;
  confidence_score?: number | null;
  game_titles?: string[];
  ticket_url?: string | null;
  description?: string | null;
};

type ReviewSource = {
  id: string;
  source_name: string;
  source_url: string;
  raw_data: RawData;
};

async function getReviewItems(): Promise<ReviewSource[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_sources")
    .select("id, source_name, source_url, raw_data")
    .eq("match_status", "review_needed")
    .order("id", { ascending: false });

  if (error) {
    console.error("[admin/review]", error);
    return [];
  }
  return (data ?? []) as ReviewSource[];
}

async function getEventRecords(): Promise<EventRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select(`
      id, event_name, start_datetime, venue_name, prefecture,
      source_url, official_url, reference_url, flyer_image_url, key_visual_url, is_published,
      organizers(name),
      event_game_titles(game_titles(title_name))
    `)
    .order("start_datetime", { ascending: true });

  if (error) {
    console.error("[admin/records]", error);
    return [];
  }
  return (data ?? []) as unknown as EventRecord[];
}

export default async function ReviewPage() {
  const [items, events] = await Promise.all([
    getReviewItems(),
    getEventRecords(),
  ]);

  const unpublishedCount = events.filter(e => !e.is_published).length;

  return (
    <div className="space-y-4">
      {/* ページヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin"
              className="text-xs text-ink-body/40 hover:text-bordeaux transition-colors"
            >
              ← ダッシュボード
            </Link>
          </div>
          <h1 className="font-heading text-ink-heading text-2xl font-semibold">
            レビューキュー
          </h1>
          <p className="text-sm text-ink-body/60 mt-0.5">
            リストをクリックして右パネルで内容を確認し、採用 / 却下を選択してください
          </p>
        </div>
        <span className="shrink-0 inline-block bg-warning/15 text-warning border border-warning/30 text-sm font-bold px-3 py-1.5 rounded-full">
          {items.length} 件
        </span>
      </div>

      {/* 凡例 */}
      <div className="bg-parchment rounded-md border border-gold/30 px-4 py-2.5 text-xs text-ink-body/60 flex flex-wrap gap-x-5 gap-y-1">
        <span className="font-medium text-ink-body/80">信頼度:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success inline-block" />
          高（70%+）= 実在の可能性大
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning inline-block" />
          中（40–70%）= 要確認
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-error inline-block" />
          低（40%未満）= ほぼノイズ
        </span>
        <span className="ml-auto text-ink-body/40">採用 = 未公開で登録 / 却下 = キューから除外</span>
      </div>

      {/* メインキュー */}
      {items.length === 0 ? (
        <div className="bg-parchment rounded-md border border-gold/30 px-6 py-12 text-center">
          <p className="text-ink-body/40 text-sm">要確認アイテムはありません</p>
        </div>
      ) : (
        <ReviewQueue items={items} />
      )}

      {/* レコード一覧 */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-heading text-ink-heading text-base font-semibold">
              レコード一覧
            </h2>
            <p className="text-xs text-ink-body/50 mt-0.5">全イベントの管理・公開制御</p>
          </div>
          <span className="text-xs text-ink-body/40">
            全 {events.length} 件（未公開 {unpublishedCount} 件）
          </span>
        </div>
        <div className="bg-parchment rounded-md border border-gold/30 px-5 py-3">
          <RecordList events={events} />
        </div>
      </div>
    </div>
  );
}
