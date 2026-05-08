-- service_role に全テーブルへの操作権限を付与
-- Supabase では service_role は RLS をバイパスするが、
-- テーブルレベルの GRANT は明示的に設定が必要な場合がある

GRANT ALL ON organizers        TO service_role;
GRANT ALL ON game_titles       TO service_role;
GRANT ALL ON events            TO service_role;
GRANT ALL ON event_game_titles TO service_role;
