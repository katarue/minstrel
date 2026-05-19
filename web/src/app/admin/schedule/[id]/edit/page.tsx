import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostForm } from "../../PostForm";
import { updateScheduledPost } from "../../actions";
import type { ScheduledPost } from "../../types";
import { STATUS_LABELS } from "../../types";

export const revalidate = 0;

export default async function EditSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await createAdminClient()
    .from("scheduled_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const post = data as ScheduledPost;

  if (post.status === "posted") {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/schedule"
          className="text-xs text-ink-body/40 hover:text-bordeaux transition-colors"
        >
          ← 予約一覧
        </Link>
        <div className="bg-parchment rounded-md border border-gold/30 px-5 py-6">
          <p className="text-sm text-ink-body/60">
            投稿済みのため編集できません。複製して新しい予約を作成してください。
          </p>
          {post.posted_tweet_url && (
            <a
              href={post.posted_tweet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-bordeaux underline underline-offset-2 hover:opacity-70"
            >
              ↗ 投稿を確認する
            </a>
          )}
        </div>
      </div>
    );
  }

  if (post.status === "cancelled") {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/schedule"
          className="text-xs text-ink-body/40 hover:text-bordeaux transition-colors"
        >
          ← 予約一覧
        </Link>
        <div className="bg-parchment rounded-md border border-gold/30 px-5 py-6">
          <p className="text-sm text-ink-body/60">
            キャンセル済みの投稿は編集できません。複製して新しい予約を作成してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/admin/schedule"
            className="text-xs text-ink-body/40 hover:text-bordeaux transition-colors"
          >
            ← 予約一覧
          </Link>
        </div>
        <h1 className="font-heading text-ink-heading text-2xl font-semibold">予約を編集</h1>
        <p className="text-sm text-ink-body/60 mt-0.5">
          ステータス: <span className="font-medium">{STATUS_LABELS[post.status]}</span>
          {post.status === "failed" && post.error_message && (
            <span className="text-error ml-2">— {post.error_message}</span>
          )}
        </p>
      </div>

      <div className="bg-parchment rounded-md border border-gold/30 px-5 py-6">
        <PostForm
          initialValues={post}
          onSubmit={updateScheduledPost.bind(null, id)}
          submitLabel="保存する"
        />
      </div>
    </div>
  );
}
