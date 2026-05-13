import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { ReviewQueue } from "./ReviewQueue";
import { UnpublishedEvents } from "./UnpublishedEvents";

export const revalidate = 0;

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

type UnpublishedEvent = {
  id: string;
  event_name: string;
  start_datetime: string | null;
  venue_name: string | null;
  prefecture: string | null;
  source_rank: string | null;
  confidence_score: number | null;
  source_url: string | null;
};

async function getUnpublishedEvents(): Promise<UnpublishedEvent[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, event_name, start_datetime, venue_name, prefecture, source_rank, confidence_score, source_url")
    .eq("is_published", false)
    .order("start_datetime", { ascending: true });

  if (error) {
    console.error("[admin/unpublished]", error);
    return [];
  }
  return (data ?? []) as UnpublishedEvent[];
}

export default async function ReviewPage() {
  const [items, unpublished] = await Promise.all([
    getReviewItems(),
    getUnpublishedEvents(),
  ]);

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

      {/* 未公開イベント一覧 */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-ink-heading text-base font-semibold">
            未公開イベント
          </h2>
          <span className="text-xs text-ink-body/40">{unpublished.length} 件 — 「公開する」で公式サイトに掲載</span>
        </div>
        <div className="bg-parchment rounded-md border border-gold/30 px-5 py-3">
          <UnpublishedEvents events={unpublished} />
        </div>
      </div>
    </div>
  );
}
