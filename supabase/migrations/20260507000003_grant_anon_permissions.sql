-- Minstrel: Game Music Concert Portal
-- anon ロールへのテーブル SELECT 権限付与
--
-- RLS ポリシー（0002）とは別に、テーブルレベルの GRANT が必要。
-- SQL マイグレーション経由でテーブルを作成した場合、Supabase は
-- anon への GRANT を自動付与しないため、明示的に設定する。
--
-- GRANT は冪等（既に付与済みでも再実行しても ERROR にならない）。

GRANT SELECT ON organizers        TO anon;
GRANT SELECT ON game_titles       TO anon;
GRANT SELECT ON events            TO anon;
GRANT SELECT ON event_game_titles TO anon;
