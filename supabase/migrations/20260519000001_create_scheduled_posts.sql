-- X予約投稿テーブル（scheduled_posts）
-- 管理画面から投稿を予約し、Prefect が自動投稿するためのテーブル。
-- RLS: 管理画面専用（anon からはアクセス不可、service_role のみ）

CREATE TYPE scheduled_post_status AS ENUM ('pending', 'posted', 'failed', 'cancelled');
CREATE TYPE scheduled_post_category AS ENUM ('release', 'new_music', 'ticket', 'youtube', 'other');

CREATE TABLE scheduled_posts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at      TIMESTAMPTZ   NOT NULL,
  status            scheduled_post_status NOT NULL DEFAULT 'pending',
  category          scheduled_post_category NOT NULL DEFAULT 'other',
  body              TEXT          NOT NULL,
  image_urls        TEXT[]        NOT NULL DEFAULT '{}',
  event_id          UUID          REFERENCES events(id) ON DELETE SET NULL,
  posted_at         TIMESTAMPTZ,
  posted_tweet_id   TEXT,
  posted_tweet_url  TEXT,
  error_message     TEXT,
  retry_count       INT           NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_posts_pending_due
  ON scheduled_posts(status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX idx_scheduled_posts_scheduled_at_desc
  ON scheduled_posts(scheduled_at DESC);

CREATE OR REPLACE FUNCTION update_scheduled_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scheduled_posts_updated_at
  BEFORE UPDATE ON scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_posts_updated_at();

-- RLS 有効化（anon / authenticated にポリシーを設定しないため service_role のみアクセス可）
-- service_role はデフォルトで RLS をバイパスするためポリシー追加不要
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
