-- event_sources.match_status に 'rejected_not_game' を追加する。
--
-- 背景: 既存の 'rejected' は「人間が候補を確認し、同一イベントではないと判断した」ケース
-- （web/src/app/admin/review/actions.ts の rejectSource）で使う想定の値であり、
-- パイプラインが「ゲーム音楽イベントではない」とAI判定した結果を記録する用途とは意味が異なる。
-- 将来 rejectSource を使ったレビューキューUIが実装された際に、AIによる自動除外と
-- 人間による手動却下が同じ値で混在しないよう、専用の値を新設する。

ALTER TABLE event_sources
  DROP CONSTRAINT IF EXISTS event_sources_match_status_check;

ALTER TABLE event_sources
  ADD CONSTRAINT event_sources_match_status_check
  CHECK (match_status IN ('new', 'matched', 'review_needed', 'rejected', 'rejected_not_game'));

COMMENT ON COLUMN event_sources.match_status IS
  'new: 取得済み・未紐付け / matched: event_idに自動紐付け済み / review_needed: ソフトキー候補あり・人間確認待ち / rejected: 人間が候補を確認し同一イベントでないと判断 / rejected_not_game: AIがゲーム音楽イベントでないと判定（event_id無し）';
