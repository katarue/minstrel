-- 楽曲キュレーションテーブル（music_curation）
-- ゲーム音楽カバーの採用審査・スコア管理・配信スケジュール管理用テーブル。
-- RLS: 管理画面専用（anon からはアクセス不可、service_role のみ）

CREATE TYPE music_curation_status AS ENUM ('unchecked', 'accepted', 'rejected', 'pending');

CREATE TABLE music_curation (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  track_name                TEXT          NOT NULL,
  composer                  TEXT,
  original_game             TEXT,
  release_year              INT,
  game_title_id             UUID          REFERENCES game_titles(id) ON DELETE SET NULL,
  cover_artist              TEXT          NOT NULL,
  cover_artist_spotify_id   TEXT,
  artist_monthly_listeners  INT,
  spotify_url               TEXT,
  amazon_music_url          TEXT,
  youtube_url               TEXT,
  acousticness              NUMERIC(3,2),
  instrumentalness          NUMERIC(3,2),
  energy                    NUMERIC(3,2),
  liveness                  NUMERIC(3,2),
  awareness_score           NUMERIC(5,2),
  skill_score               NUMERIC(5,2),
  emotion_score             NUMERIC(5,2),
  stability_score           NUMERIC(5,2),
  total_score               NUMERIC(5,2),
  hi_res_available          BOOLEAN       NOT NULL DEFAULT FALSE,
  is_live_performance       BOOLEAN,
  status                    music_curation_status NOT NULL DEFAULT 'unchecked',
  scheduled_week            TEXT,
  scheduled_post_id         UUID          REFERENCES scheduled_posts(id) ON DELETE SET NULL,
  notes                     TEXT,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_music_curation_status
  ON music_curation(status);

CREATE INDEX idx_music_curation_total_score
  ON music_curation(total_score DESC NULLS LAST);

CREATE INDEX idx_music_curation_scheduled_week
  ON music_curation(scheduled_week)
  WHERE scheduled_week IS NOT NULL;

CREATE OR REPLACE FUNCTION update_music_curation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_music_curation_updated_at
  BEFORE UPDATE ON music_curation
  FOR EACH ROW
  EXECUTE FUNCTION update_music_curation_updated_at();

-- RLS 有効化（anon / authenticated にポリシーを設定しないため service_role のみアクセス可）
-- service_role はデフォルトで RLS をバイパスするためポリシー追加不要
ALTER TABLE music_curation ENABLE ROW LEVEL SECURITY;
