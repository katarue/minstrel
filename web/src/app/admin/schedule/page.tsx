import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { ScheduleListClient } from "./ScheduleListClient";
import type { ScheduledPost, ScheduledPostStatus } from "./types";
import { STATUS_LABELS } from "./types";

export const revalidate = 0;

const ALL_STATUSES: (ScheduledPostStatus | "all")[] = [
  "all",
  "pending",
  "posted",
  "failed",
  "cancelled",
];
const PAGE_SIZE = 20;

async function getPosts(
  status: ScheduledPostStatus | "all",
  page: number
): Promise<{ posts: ScheduledPost[]; total: number }> {
  const supabase = createAdminClient();
  let query = supabase
    .from("scheduled_posts")
    .select("*", { count: "exact" })
    .order("scheduled_at", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status !== "all") {
    query = query.eq("status", status);
  } else {
    // pending を先に、それ以外は scheduled_at 降順
    query = supabase
      .from("scheduled_posts")
      .select("*", { count: "exact" })
      .order("status", { ascending: true }) // pending がアルファベット順で先
      .order("scheduled_at", { ascending: true })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  }

  const { data, count, error } = await query;
  if (error) console.error("[admin/schedule]", error);
  return { posts: (data ?? []) as ScheduledPost[], total: count ?? 0 };
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = (
    ALL_STATUSES.includes(sp.status as ScheduledPostStatus) ? sp.status : "all"
  ) as ScheduledPostStatus | "all";
  const page = Math.max(1, parseInt(sp.page ?? "1"));

  const { posts, total } = await getPosts(status, page);
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
          <h1 className="font-heading text-ink-heading text-2xl font-semibold">X予約投稿</h1>
          <p className="text-sm text-ink-body/60 mt-0.5">
            X（旧Twitter）への投稿を事前予約する
          </p>
        </div>
        <Link
          href="/admin/schedule/new"
          className="shrink-0 mt-2 font-body text-sm bg-bordeaux text-parchment hover:bg-bordeaux/80 transition-colors rounded px-3 py-1.5"
        >
          ＋ 新規予約
        </Link>
      </div>

      {/* ステータスフィルタ タブ */}
      <div className="flex gap-1 border-b border-gold/30 overflow-x-auto">
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/schedule?status=${s}`}
            className={`font-body text-xs px-3 py-2 border-b-2 whitespace-nowrap transition-colors ${
              status === s
                ? "border-bordeaux text-bordeaux font-semibold"
                : "border-transparent text-ink-body/60 hover:text-bordeaux"
            }`}
          >
            {s === "all" ? "すべて" : STATUS_LABELS[s]}
            {s === "all" && total > 0 && (
              <span className="ml-1 text-ink-body/40">({total})</span>
            )}
          </Link>
        ))}
      </div>

      {/* リスト */}
      <div className="bg-parchment rounded-md border border-gold/30 px-5 py-3">
        <ScheduleListClient posts={posts} />
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/schedule?status=${status}&page=${p}`}
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
