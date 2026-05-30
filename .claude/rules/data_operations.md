# Data Operations（Supabase 操作・イベントデータ入力）

minstrel 固有のデータ運用ルール。

## Supabase 操作ルール

- **DML（SELECT / INSERT / UPDATE / DELETE）**: Claude Code が Python Supabase クライアント経由で直接実行する。ムーチョに SQL Editor の操作を依頼してはいけない。
- **DDL（CREATE TABLE / ALTER TABLE 等）**: PostgREST 経由では実行不可のため、ムーチョに Supabase SQL Editor での実行を依頼する。

```python
# DML の実行例（python/ ディレクトリで実行）
from utils.config import SUPABASE_URL, SUPABASE_SECRET_KEY
from supabase import create_client
db = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
db.table("events").delete().eq("id", some_id).execute()
```

## イベントデータ入力ルール

### 1公演 = 1レコードの原則

複数の会場・日程にまたがるツアーは、必ず会場ごとに別レコードとして登録する。

| NG（禁止）| OK |
|---|---|
| `prefecture: "東京都、大阪府"` | 東京公演レコード + 大阪公演レコード |
| `venue_name: "会場A、会場B"` | 各レコードに単一の会場名 |

### ツアーのまとめ方

1. 各会場を個別レコードで登録（`prefecture`, `venue_name` は単一値）
2. イベント名の末尾に都市名を付ける: `〇〇コンサートツアー（東京）`
3. 登録後に `python scripts/assign_tour_ids.py` を実行 → 同一オーガナイザー+タイトルで自動的に `tour_id` が付与される

### 確認コマンド

```bash
# 複数会場が混入していないか確認（「、」「/」「／」区切りを検出）
python -c "
from utils.db import get_client
db = get_client()
r = db.table('events').select('id, event_name, prefecture, venue_name').eq('is_published', True).execute()
multi = [ev for ev in r.data if ev.get('prefecture') and any(sep in ev['prefecture'] for sep in ['、', '/', '／'])
         or ev.get('venue_name') and any(sep in ev['venue_name'] for sep in ['、', '/', '／'])]
print(f'要修正: {len(multi)} 件')
for ev in multi: print(' ', ev['event_name'])
"
```
