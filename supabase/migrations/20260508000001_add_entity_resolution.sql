-- Minstrel: エンティティ・レゾリューション基盤
-- event_sources: 各情報ソースの生データ置き場（リカバリー用）
-- event_external_ids: ハードキー管理（チケットURL・公式URL等）

-- ============================================================
-- event_sources（情報ソース履歴）
-- ============================================================
CREATE TABLE event_sources (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        REFERENCES events(id) ON DELETE SET NULL,
  source_name TEXT        NOT NULL,
  -- 'teket' | 'x_search' | '2083web' | 'peatix' | 'passmarket' | 'eplus' | ...
  source_url  TEXT        NOT NULL,
  raw_data    JSONB,
  -- match_status: 紐付け状態
  -- 'new'          ... 取得済み・未紐付け
  -- 'matched'      ... event_id に自動紐付け済み（ハードキー一致）
  -- 'review_needed'... ソフトキー候補あり・人間確認待ち
  -- 'rejected'     ... 同一イベントではないと確認済み
  match_status TEXT        NOT NULL DEFAULT 'new'
                           CHECK (match_status IN ('new', 'matched', 'review_needed', 'rejected')),
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_url)
);

CREATE INDEX idx_event_sources_event_id     ON event_sources (event_id);
CREATE INDEX idx_event_sources_source_name  ON event_sources (source_name);
CREATE INDEX idx_event_sources_match_status ON event_sources (match_status);


-- ============================================================
-- event_external_ids（外部IDによるハードキー管理）
-- ============================================================
CREATE TABLE event_external_ids (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  id_type        TEXT NOT NULL,
  -- 'ticket_url'   ... チケット購入ページURL (teket / peatix / passmarket / eplus / 等)
  -- 'official_url' ... 主催者公式サイトのイベントページURL
  -- 'x_url'        ... X(Twitter)のイベント告知ツイートURL
  normalized_value TEXT NOT NULL,
  -- URLはクエリパラメータを除去して正規化した値を格納
  UNIQUE (id_type, normalized_value)
);

CREATE INDEX idx_event_external_ids_event_id         ON event_external_ids (event_id);
CREATE INDEX idx_event_external_ids_type_value       ON event_external_ids (id_type, normalized_value);


-- ============================================================
-- RLS（anon は参照不可、service_role のみ操作可）
-- ============================================================
ALTER TABLE event_sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_external_ids ENABLE ROW LEVEL SECURITY;

-- anon には一切見せない（パイプライン内部テーブル）
CREATE POLICY "deny_anon_event_sources"
  ON event_sources FOR ALL TO anon USING (false);

CREATE POLICY "deny_anon_event_external_ids"
  ON event_external_ids FOR ALL TO anon USING (false);


-- ============================================================
-- GRANT（service_role はすべて操作可）
-- ============================================================
GRANT ALL ON event_sources      TO service_role;
GRANT ALL ON event_external_ids TO service_role;
