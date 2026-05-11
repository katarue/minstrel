import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { ReviewItem } from "./ReviewItem";

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

export default async function ReviewPage() {
  const items = await getReviewItems();

  return (
    <div className="space-y-6">
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
            自動判定できなかった収集データを確認してください
          </p>
        </div>
        <span className="shrink-0 inline-block bg-warning/15 text-warning border border-warning/30 text-sm font-bold px-3 py-1.5 rounded-full">
          {items.length} 件
        </span>
      </div>

      {/* 凡例 */}
      <div className="bg-parchment rounded-md border border-gold/30 px-4 py-3 text-xs text-ink-body/60 flex flex-wrap gap-x-6 gap-y-1.5">
        <span className="font-medium text-ink-body/80">判断の目安:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success inline-block" />
          信頼度 高（70%+）= 実在するイベントの可能性大
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning inline-block" />
          信頼度 中（40–70%）= 要確認
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-error inline-block" />
          信頼度 低（40%未満）= ほぼノイズ
        </span>
      </div>

      {/* ボタンの説明 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-parchment rounded-md border border-gold/30 px-5 py-4 space-y-2">
          <p className="text-sm font-medium text-ink-heading flex items-center gap-2">
            <span className="inline-block bg-bordeaux text-parchment text-xs px-2 py-0.5 rounded">採用</span>
            を押すと…
          </p>
          <ol className="text-xs text-ink-body/70 space-y-1.5 list-none">
            <li className="flex gap-2"><span className="text-bordeaux font-bold shrink-0">1.</span>同じイベント名・同じ日付のイベントがすでにDBにあるか自動検索（重複チェック）</li>
            <li className="flex gap-2"><span className="text-bordeaux font-bold shrink-0">2a.</span>重複あり → 既存イベントにこのツイートを紐付けて終了（新規作成しない）</li>
            <li className="flex gap-2"><span className="text-bordeaux font-bold shrink-0">2b.</span>重複なし → 新規イベントとしてDBに登録（<span className="font-medium">未公開状態</span>で保存）</li>
            <li className="flex gap-2"><span className="text-bordeaux font-bold shrink-0">3.</span>未公開イベントは Supabase の管理画面で内容を確認し、<code className="bg-parchment-dark px-1 rounded">is_published = true</code> にすると公開される</li>
          </ol>
          <p className="text-xs text-ink-body/40 pt-1">※ タイトルまたは日時が取得できていない場合はエラーになります</p>
        </div>
        <div className="bg-parchment rounded-md border border-gold/30 px-5 py-4 space-y-2">
          <p className="text-sm font-medium text-ink-heading flex items-center gap-2">
            <span className="inline-block border border-ink-body/20 text-ink-body/60 text-xs px-2 py-0.5 rounded">却下</span>
            を押すと…
          </p>
          <ol className="text-xs text-ink-body/70 space-y-1.5 list-none">
            <li className="flex gap-2"><span className="text-ink-body/40 font-bold shrink-0">1.</span>このアイテムのステータスを「却下済み」に変更してリューキューから除外</li>
            <li className="flex gap-2"><span className="text-ink-body/40 font-bold shrink-0">2.</span>DBからは削除しない（<code className="bg-parchment-dark px-1 rounded">event_sources</code> テーブルに記録は残る）</li>
            <li className="flex gap-2"><span className="text-ink-body/40 font-bold shrink-0">3.</span>公開サイトには一切影響しない</li>
          </ol>
          <p className="text-xs text-ink-body/40 pt-1">※ ノイズ・無関係なツイート・すでにDBにある情報はすべて却下でOK</p>
        </div>
      </div>

      {/* アイテムリスト */}
      {items.length === 0 ? (
        <div className="bg-parchment rounded-md border border-gold/30 px-6 py-12 text-center">
          <p className="text-ink-body/40 text-sm">要確認アイテムはありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ReviewItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
