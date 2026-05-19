import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { PostForm } from "../PostForm";
import { createScheduledPost } from "../actions";
import type { ScheduledPost } from "../types";

export const revalidate = 0;

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string }>;
}) {
  const sp = await searchParams;
  let initialValues: Partial<ScheduledPost> | undefined;

  if (sp.copy) {
    const { data } = await createAdminClient()
      .from("scheduled_posts")
      .select("category, body, image_urls")
      .eq("id", sp.copy)
      .single();
    if (data) {
      initialValues = {
        category: data.category,
        body: data.body,
        image_urls: data.image_urls,
      };
    }
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
        <h1 className="font-heading text-ink-heading text-2xl font-semibold">
          {sp.copy ? "投稿を複製" : "新規予約"}
        </h1>
        <p className="text-sm text-ink-body/60 mt-0.5">
          {sp.copy
            ? "既存の投稿をもとに新しい予約を作成します"
            : "X（旧Twitter）への投稿を事前予約します"}
        </p>
      </div>

      <div className="bg-parchment rounded-md border border-gold/30 px-5 py-6">
        <PostForm
          initialValues={initialValues}
          onSubmit={createScheduledPost}
          submitLabel="予約する"
        />
      </div>
    </div>
  );
}
