-- venue_name の NOT NULL 制約を解除
-- 会場未確定・会場なし（オンライン等）のイベントが存在するため
ALTER TABLE events ALTER COLUMN venue_name DROP NOT NULL;
