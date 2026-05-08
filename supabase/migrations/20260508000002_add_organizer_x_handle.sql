-- organizers テーブルに X ハンドル管理カラムを追加
-- x_url はすでに存在するが、from: 検索用に handle（@なし）を別途管理する

ALTER TABLE organizers
  ADD COLUMN IF NOT EXISTS x_handle          TEXT,   -- 例: '_LJO_'（@なし）
  ADD COLUMN IF NOT EXISTS discovery_source  TEXT,   -- どこで発見したか
  ADD COLUMN IF NOT EXISTS x_monitoring      BOOLEAN NOT NULL DEFAULT FALSE;
  -- true = from: 指定検索の対象として監視中

CREATE INDEX idx_organizers_x_monitoring ON organizers (x_monitoring)
  WHERE x_monitoring = TRUE;

-- ────────────────────────────────────────────────────
-- シードデータ: 調査済みの主要演奏団体
-- （x_monitoring=true は今後の from: 検索対象）
-- ────────────────────────────────────────────────────
INSERT INTO organizers (name, x_url, x_handle, x_monitoring, discovery_source, region)
VALUES
  ('リトルジャックオーケストラ',
   'https://x.com/_LJO_', '_LJO_', TRUE, 'manual_seed', '関東'),

  ('ラピスドリームオーケストラ',
   'https://x.com/LapisDream', 'LapisDream', TRUE, 'manual_seed', '関西'),

  ('名古屋ゲームミュージックアンサンブル',
   'https://x.com/nagoyagme', 'nagoyagme', TRUE, 'manual_seed', '東海'),

  ('コスモスカイオーケストラ',
   NULL, NULL, FALSE, 'manual_seed', NULL),

  ('JAGMO',
   NULL, NULL, FALSE, 'manual_seed', '関東'),

  ('プレイヤーズパーティー・オーケストラ',
   NULL, NULL, FALSE, 'manual_seed', '北海道')
ON CONFLICT DO NOTHING;

-- RLS: organizers は anon も SELECT 可（既存ポリシーに準拠）
-- 追加カラムのみなので既存 RLS に変更なし
