-- prefecture の NOT NULL 制約を解除
-- 会場未確定・オンライン等、都道府県が特定できないイベントが存在するため
ALTER TABLE events ALTER COLUMN prefecture DROP NOT NULL;
