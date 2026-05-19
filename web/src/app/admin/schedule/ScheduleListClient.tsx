"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  deleteScheduledPost,
  cancelScheduledPost,
  retryScheduledPost,
  duplicateScheduledPost,
} from "./actions";
import type { ScheduledPost, ScheduledPostStatus } from "./types";
import { STATUS_LABELS, STATUS_BADGE_CLASS, CATEGORY_LABELS } from "./types";

function fmtJst(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PostRow({ post }: { post: ScheduledPost }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("削除してもよいですか？この操作は元に戻せません。")) return;
    startTransition(async () => { await deleteScheduledPost(post.id); });
  };

  const handleCancel = () => {
    if (!confirm("この予約をキャンセルしてもよいですか？")) return;
    startTransition(async () => { await cancelScheduledPost(post.id); });
  };

  const handleRetry = () =>
    startTransition(async () => { await retryScheduledPost(post.id); });

  const handleDuplicate = () =>
    startTransition(async () => { await duplicateScheduledPost(post.id); });

  const isLoading = isPending;

  return (
    <tr className={`border-b border-gold/10 hover:bg-gold/5 transition-colors ${isLoading ? "opacity-40" : ""}`}>
      <td className="py-3 pr-4 whitespace-nowrap align-top">
        <span className="font-mono text-sm text-ink-body">{fmtJst(post.scheduled_at)}</span>
      </td>

      <td className="py-3 pr-4 align-top">
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[post.status]}`}>
          {STATUS_LABELS[post.status]}
        </span>
        {post.retry_count > 0 && (
          <span className="block text-xs text-ink-body/40 mt-0.5">再試行 {post.retry_count}/{3}</span>
        )}
      </td>

      <td className="py-3 pr-4 align-top">
        <span className="text-xs text-ink-body/70">{CATEGORY_LABELS[post.category]}</span>
      </td>

      <td className="py-3 pr-4 max-w-xs align-top">
        <p className="text-sm text-ink-body">
          {post.body.length > 50 ? post.body.slice(0, 50) + "…" : post.body}
        </p>
        {post.error_message && (
          <p className="text-xs text-error mt-0.5 line-clamp-2">{post.error_message}</p>
        )}
      </td>

      <td className="py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* pending: 編集・キャンセル */}
          {post.status === "pending" && (
            <>
              <Link
                href={`/admin/schedule/${post.id}/edit`}
                className="text-xs px-2 py-0.5 rounded border border-gold/30 text-ink-body/70 hover:border-bordeaux hover:text-bordeaux transition-colors whitespace-nowrap"
              >
                編集
              </Link>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="text-xs px-2 py-0.5 rounded border border-gold/30 text-ink-body/70 hover:border-warning hover:text-warning transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                キャンセル
              </button>
            </>
          )}

          {/* posted: 投稿確認リンク */}
          {post.status === "posted" && post.posted_tweet_url && (
            <a
              href={post.posted_tweet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-0.5 rounded border border-gold/30 text-bordeaux hover:bg-bordeaux/5 transition-colors whitespace-nowrap"
            >
              ↗ 投稿確認
            </a>
          )}

          {/* failed: 編集・再試行 */}
          {post.status === "failed" && (
            <>
              <Link
                href={`/admin/schedule/${post.id}/edit`}
                className="text-xs px-2 py-0.5 rounded border border-gold/30 text-ink-body/70 hover:border-bordeaux hover:text-bordeaux transition-colors whitespace-nowrap"
              >
                編集
              </Link>
              <button
                onClick={handleRetry}
                disabled={isLoading}
                className="text-xs px-2 py-0.5 rounded border border-gold/30 text-ink-body/70 hover:border-success hover:text-success transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                再試行
              </button>
            </>
          )}

          {/* 共通: 複製 */}
          <button
            onClick={handleDuplicate}
            disabled={isLoading}
            className="text-xs px-2 py-0.5 rounded border border-gold/30 text-ink-body/70 hover:border-bordeaux hover:text-bordeaux transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            複製
          </button>

          {/* posted 以外: 削除 */}
          {post.status !== "posted" && (
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className="text-xs px-2 py-0.5 rounded border border-error/30 text-error/70 hover:bg-error/10 hover:text-error transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              削除
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ScheduleListClient({ posts }: { posts: ScheduledPost[] }) {
  if (posts.length === 0) {
    return (
      <p className="text-sm text-ink-body/50 py-8 text-center">予約投稿がありません</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gold/20">
            {(["投稿予定日時", "ステータス", "カテゴリ", "本文", "アクション"] as const).map((h) => (
              <th
                key={h}
                className="pb-2 pr-4 text-xs text-ink-body/50 uppercase tracking-wide font-medium whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
