-- events テーブルに、管理画面でその場編集により手動修正されたフィールド名を記録するカラムを追加する。
--
-- 背景: 管理画面で日付・時間・都道府県・会場名・主催者名をその場編集できるようにするにあたり、
-- 手で直した値が次回以降の自動収集（再スクレイピング）で上書きされないようにする必要がある。
-- 既存の merge_fields() / auto_enrich() は「既存値が空の場合のみ補完」という設計のため
-- 現状でも上書きは起きにくいが、将来の実装変更に対する保険として、
-- どのフィールドを人間が手で直したかを明示的に記録する。

ALTER TABLE events
  ADD COLUMN manually_edited_fields TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN events.manually_edited_fields IS
  '管理画面のその場編集で手動修正されたフィールド名の一覧（例: start_datetime, venue_name, prefecture, organizer_id）。収集パイプラインはこの一覧に含まれるフィールドを自動上書きしない。';
