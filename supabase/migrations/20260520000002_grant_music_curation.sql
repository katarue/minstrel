-- music_curation テーブルへの service_role 権限付与
-- scheduled_posts と同様に明示的な GRANT が必要

GRANT ALL ON music_curation TO service_role;
