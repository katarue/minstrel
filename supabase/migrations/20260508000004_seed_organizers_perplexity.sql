-- Perplexity 調査結果による演奏団体シードデータ追加
-- 確度高め（x_monitoring=true）: 5件
-- 有力候補（x_monitoring=false）: 3件
-- 名古屋ゲームミュージックアンサンブルは除外対象・既存データあり → スキップ

INSERT INTO organizers (name, x_url, x_handle, x_monitoring, discovery_source, region)
VALUES
  -- ── 確度高め（monitoring 対象）────────────────────────────────────
  ('テンプルナイツ交響楽団',
   'https://x.com/fft_orche', 'fft_orche', TRUE, 'perplexity_search', '関東'),

  ('北海道ゲーム音楽吹奏楽団',
   'https://x.com/HokkaidoGMBand', 'HokkaidoGMBand', TRUE, 'perplexity_search', '北海道'),

  ('Radical Light Gamers',
   'https://x.com/Rad_Mandolin', 'Rad_Mandolin', TRUE, 'perplexity_search', '関東'),

  ('Game Music in Brass',
   'https://x.com/gmib_PR', 'gmib_PR', TRUE, 'perplexity_search', NULL),

  ('2 Dimension Ensemble',
   'https://x.com/2DEnsemble', '2DEnsemble', TRUE, 'perplexity_search', '関東'),

  -- ── 有力候補（様子見・monitoring 外）──────────────────────────────
  ('MUSICエンジン',
   'https://x.com/musicengine_tw', 'musicengine_tw', FALSE, 'perplexity_search', NULL),

  ('洗足ゲーム音楽ブラス',
   'https://x.com/senzokugmb', 'senzokugmb', FALSE, 'perplexity_search', '関東'),

  ('ゲーム音楽onlyアンサンブル',
   'https://x.com/gameonlymusic', 'gameonlymusic', FALSE, 'perplexity_search', '関東')

ON CONFLICT DO NOTHING;
