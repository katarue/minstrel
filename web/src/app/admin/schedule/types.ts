export type ScheduledPostStatus = "pending" | "posted" | "failed" | "cancelled";
export type ScheduledPostCategory = "release" | "new_music" | "ticket" | "youtube" | "other";

export type ScheduledPost = {
  id: string;
  scheduled_at: string;
  status: ScheduledPostStatus;
  category: ScheduledPostCategory;
  body: string;
  image_urls: string[];
  event_id: string | null;
  posted_at: string | null;
  posted_tweet_id: string | null;
  posted_tweet_url: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
};

export const CATEGORY_LABELS: Record<ScheduledPostCategory, string> = {
  release: "新発売",
  new_music: "新曲",
  ticket: "チケット",
  youtube: "YouTube",
  other: "その他",
};

export const STATUS_LABELS: Record<ScheduledPostStatus, string> = {
  pending: "予約中",
  posted: "投稿済",
  failed: "失敗",
  cancelled: "キャンセル",
};

export const STATUS_BADGE_CLASS: Record<ScheduledPostStatus, string> = {
  pending: "bg-warning/20 text-warning",
  posted: "bg-success/20 text-success",
  failed: "bg-error/20 text-error",
  cancelled: "bg-ink-body/10 text-ink-body/50",
};
