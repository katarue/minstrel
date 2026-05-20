import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { MusicCurationListClient } from "./MusicCurationListClient";
import type { MusicCuration, MusicCurationStatus } from "./types";
import { STATUS_LABELS } from "./types";

export const revalidate = 0;

const ALL_STATUSES: (MusicCurationStatus | "all")[] = [
  "all",
  "unchecked",
  "accepted",
  "pending",
  "rejected",
];
const PAGE_SIZE = 30;

async function getTracks(
  status: MusicCurationStatus | "all",
  page: number
): Promise<{ tracks: MusicCuration[]; total: number }> {
  const supabase = createAdminClient();
  let query = supabase
    .from("music_curation")
    .select("*", { count: "exact" })
    .order("total_score", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;
  if (error) console.error("[admin/music_curation]", error);
  return { tracks: (data ?? []) as MusicCuration[], total: count ?? 0 };
}

export default async function MusicCurationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = (
    ALL_STATUSES.includes(sp.status as MusicCurationStatus) ? sp.status : "all"
  ) as MusicCurationStatus | "all";
  const page = Math.max(1, parseInt(sp.page ?? "1"));

  const { tracks, total } = await getTracks(status, page);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
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
          <h1 className="font-heading text-ink-heading text-2xl font-semibold">楽曲キュレーション</h1>
          <p className="text-sm text-ink-body/60 mt-0.5">
            ゲーム音楽カバーの採用・管理
          </p>
        </div>
        <Link
          href="/admin/music_curation/import"
          className="shrink-0 mt-2 font-body text-sm bg-bordeaux text-parchment hover:bg-bordeaux/80 transition-colors rounded px-3 py-1.5"
        >
          ＋ インポート
        </Link>
      </div>

      {/* ステータスタブ */}
      <div className="flex gap-1 border-b border-gold/30 overflow-x-auto">
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/music_curation?status=${s}`}
            className={`font-body text-xs px-3 py-2 border-b-2 whitespace-nowrap transition-colors ${
              status === s
                ? "border-bordeaux text-bordeaux font-semibold"
                : "border-transparent text-ink-body/60 hover:text-bordeaux"
            }`}
          >
            {s === "all" ? "すべて" : STATUS_LABELS[s as MusicCurationStatus]}
            {s === "all" && total > 0 && (
              <span className="ml-1 text-ink-body/40">({total})</span>
            )}
          </Link>
        ))}
      </div>

      {/* リスト */}
      <div className="bg-parchment rounded-md border border-gold/30 px-5 py-3">
        <MusicCurationListClient tracks={tracks} />
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/music_curation?status=${status}&page=${p}`}
              className={`font-body text-xs px-2.5 py-1 rounded border transition-colors ${
                p === page
                  ? "bg-bordeaux text-parchment border-bordeaux"
                  : "border-gold/30 text-ink-body/60 hover:border-bordeaux"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
