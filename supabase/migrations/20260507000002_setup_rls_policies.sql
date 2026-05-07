-- Minstrel: Game Music Concert Portal
-- RLS ポリシー設定（冪等、再実行可能）
--
-- ポリシー方針:
--   anon         : 公開データの SELECT のみ
--   service_role : すべての操作を許可（パイプライン・管理操作用）
--   authenticated: 現時点では anon と同等（管理画面実装時に追加）


-- ============================================================
-- RLS 有効化（既に有効でも冪等）
-- ============================================================
ALTER TABLE organizers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_titles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_game_titles  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 既存ポリシーを DROP（冪等化）
-- ============================================================
DROP POLICY IF EXISTS "anon_select_organizers"        ON organizers;
DROP POLICY IF EXISTS "anon_select_game_titles"       ON game_titles;
DROP POLICY IF EXISTS "anon_select_events"            ON events;
DROP POLICY IF EXISTS "anon_select_event_game_titles" ON event_game_titles;


-- ============================================================
-- organizers（演奏団体）
-- anon: 全件 SELECT 可（団体情報は公開前提）
-- ============================================================
CREATE POLICY "anon_select_organizers"
  ON organizers
  FOR SELECT
  TO anon
  USING (TRUE);


-- ============================================================
-- game_titles（ゲームタイトル）
-- anon: 全件 SELECT 可（タイトル情報は公開前提）
-- ============================================================
CREATE POLICY "anon_select_game_titles"
  ON game_titles
  FOR SELECT
  TO anon
  USING (TRUE);


-- ============================================================
-- events（イベント）
-- anon: is_published = true のレコードのみ SELECT 可
-- ============================================================
CREATE POLICY "anon_select_events"
  ON events
  FOR SELECT
  TO anon
  USING (is_published = TRUE);


-- ============================================================
-- event_game_titles（中間テーブル）
-- anon: 全件 SELECT 可
--   ※ is_published = false のイベントに対応する行は events 側の
--      ポリシーによって JOIN 結果から除外されるため、ここでは制御不要
-- ============================================================
CREATE POLICY "anon_select_event_game_titles"
  ON event_game_titles
  FOR SELECT
  TO anon
  USING (TRUE);


-- ============================================================
-- service_role はポリシー不要
-- ============================================================
-- Supabase の service_role はデフォルトで RLS をバイパスするため、
-- 明示的なポリシー追加は不要。
