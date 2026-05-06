-- Minstrel: Game Music Concert Portal
-- Initial schema: organizers, game_titles, events, event_game_titles

-- updated_at を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- organizers（演奏団体）
-- ============================================================
CREATE TABLE organizers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  description       TEXT,
  official_site_url TEXT,
  x_url             TEXT,
  instagram_url     TEXT,
  youtube_url       TEXT,
  region            TEXT,
  founded_year      INTEGER,
  key_visual_url    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizers_name ON organizers (name);

CREATE TRIGGER trg_organizers_updated_at
  BEFORE UPDATE ON organizers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- game_titles（ゲームタイトル）
-- ============================================================
CREATE TABLE game_titles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title_name     TEXT        NOT NULL,
  series_name    TEXT,
  publisher      TEXT,
  key_visual_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_titles_title_name  ON game_titles (title_name);
CREATE INDEX idx_game_titles_series_name ON game_titles (series_name);

CREATE TRIGGER trg_game_titles_updated_at
  BEFORE UPDATE ON game_titles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- events（イベント）
-- ============================================================
CREATE TABLE events (

  -- 基本情報
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name                 TEXT        NOT NULL,
  key_visual_url             TEXT,
  flyer_image_url            TEXT,
  description                TEXT,
  performance_type           TEXT,

  -- 日時・場所
  start_datetime             TIMESTAMPTZ NOT NULL,
  open_datetime              TIMESTAMPTZ,
  venue_name                 TEXT        NOT NULL,
  venue_address              TEXT,
  venue_google_maps_url      TEXT,
  prefecture                 TEXT        NOT NULL,
  region                     TEXT,

  -- チケット情報
  ticket_prices              JSONB,
  seat_type                  TEXT,
  general_sale_date          DATE,
  presale_date               DATE,
  presale_type               TEXT,
  ticket_urls                JSONB,
  ticket_status              TEXT        CHECK (ticket_status IN ('available', 'few_left', 'sold_out', 'before_sale')),
  is_free                    BOOLEAN     NOT NULL DEFAULT FALSE,
  age_restriction            TEXT,

  -- 配信情報
  has_streaming              BOOLEAN     NOT NULL DEFAULT FALSE,
  streaming_type             TEXT,
  streaming_url              TEXT,
  streaming_price            TEXT,

  -- 演奏情報（game_title_ids は event_game_titles 中間テーブルで管理）
  organizer_id               UUID        REFERENCES organizers (id) ON DELETE SET NULL,
  performers                 TEXT,

  -- 特記事項
  cosplay_allowed            BOOLEAN,
  photography_allowed        BOOLEAN,
  recording_allowed          BOOLEAN,
  children_allowed           BOOLEAN,
  special_notes              TEXT,

  -- ステータス管理
  is_canceled                BOOLEAN     NOT NULL DEFAULT FALSE,
  is_postponed               BOOLEAN     NOT NULL DEFAULT FALSE,
  status_change_type         TEXT        CHECK (status_change_type IN ('new', 'updated', 'canceled', 'postponed')),
  status_change_detected_at  TIMESTAMPTZ,

  -- 自動公開判定（機械検証用）
  source_url                 TEXT,
  official_source_url        TEXT,
  source_rank                TEXT        CHECK (source_rank IN ('A', 'B', 'C')),
  confidence_score           INTEGER     CHECK (confidence_score BETWEEN 0 AND 100),
  auto_publish_eligible      BOOLEAN     NOT NULL DEFAULT FALSE,
  blocking_reason            TEXT,
  duplicate_group_id         UUID,
  collected_at               TIMESTAMPTZ,
  last_checked_at            TIMESTAMPTZ,
  last_verified_at           TIMESTAMPTZ,

  -- 掲載管理
  is_published               BOOLEAN     NOT NULL DEFAULT FALSE,
  manual_review_required     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 公開済みイベントの日程・地域検索用（サイトの主要クエリ）
CREATE INDEX idx_events_start_datetime         ON events (start_datetime);
CREATE INDEX idx_events_prefecture             ON events (prefecture);
CREATE INDEX idx_events_region                 ON events (region);
CREATE INDEX idx_events_is_published           ON events (is_published);
CREATE INDEX idx_events_auto_publish_eligible  ON events (auto_publish_eligible);
CREATE INDEX idx_events_organizer_id           ON events (organizer_id);
CREATE INDEX idx_events_is_canceled            ON events (is_canceled);
CREATE INDEX idx_events_is_postponed           ON events (is_postponed);
CREATE INDEX idx_events_duplicate_group_id     ON events (duplicate_group_id);

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- event_game_titles（イベント × ゲームタイトル 中間テーブル）
-- ============================================================
CREATE TABLE event_game_titles (
  event_id      UUID        NOT NULL REFERENCES events (id)      ON DELETE CASCADE,
  game_title_id UUID        NOT NULL REFERENCES game_titles (id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, game_title_id)
);

-- game_title_id 側からの逆引き用
CREATE INDEX idx_event_game_titles_game_title_id ON event_game_titles (game_title_id);
