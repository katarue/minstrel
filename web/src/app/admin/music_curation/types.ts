export type MusicCurationStatus = "unchecked" | "accepted" | "rejected" | "pending";

export type MusicCuration = {
  id: string;
  track_name: string;
  composer: string | null;
  original_game: string | null;
  release_year: number | null;
  game_title_id: string | null;
  cover_artist: string;
  cover_artist_spotify_id: string | null;
  artist_monthly_listeners: number | null;
  spotify_url: string | null;
  amazon_music_url: string | null;
  youtube_url: string | null;
  acousticness: number | null;
  instrumentalness: number | null;
  energy: number | null;
  liveness: number | null;
  awareness_score: number | null;
  skill_score: number | null;
  emotion_score: number | null;
  stability_score: number | null;
  total_score: number | null;
  hi_res_available: boolean;
  is_live_performance: boolean | null;
  status: MusicCurationStatus;
  scheduled_week: string | null;
  scheduled_post_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABELS: Record<MusicCurationStatus, string> = {
  unchecked: "未確認",
  accepted: "採用",
  rejected: "却下",
  pending: "保留",
};

export const STATUS_BADGE_CLASS: Record<MusicCurationStatus, string> = {
  unchecked: "bg-ink-body/10 text-ink-body/60",
  accepted: "bg-success/20 text-success",
  rejected: "bg-error/20 text-error",
  pending: "bg-warning/20 text-warning",
};
