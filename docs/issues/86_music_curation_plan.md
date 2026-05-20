# 楽曲キュレーション・自動投稿システム 計画書 v2

GitHub Issue: https://github.com/katarue/minstrel/issues/86

> **⚠️ API変更（2026-05-20）**: データ収集は Spotify API → **Last.fm API** に変更済み。
> Spotify API は 2024年末の規約変更でアプリ作成者の Premium 契約が必須となり利用不可になったため。
> 詳細は [Issue #86 コメント](https://github.com/katarue/minstrel/issues/86#issuecomment-4497847539) 参照。

## プロジェクト概要

Last.fm API でゲーム音楽の生演奏カバーを自動収集し、管理画面でキュレーションして週1で X 自動投稿するシステム。

### フロー全体像

```
Spotify API で収集
  → スコアリング（5軸）
  → music_curation テーブルに投入
  → 管理画面で採用/却下
  → 週1で X 投稿（試聴 YouTube・マネタイズ Amazon Music）
```

---

## スプリント構成

| スプリント | 内容 | 状態 |
|---|---|---|
| Sprint 0 | `music_curation` テーブル + 管理画面 UI | ✅ 完了（2026-05-20） |
| Sprint 1 | Spotify API 楽曲収集スクリプト + 100 曲投入 | 🚧 着手中 |
| Sprint 2 | 週次 X 自動投稿フロー | 未着手 |

---

## Sprint 1: Spotify API 楽曲収集スクリプト

### ディレクトリ構成

```
python/curation/
  ├ __init__.py
  ├ spotify_client.py       # Spotify API ラッパー
  ├ supabase_writer.py      # Supabase 書き込み
  ├ scoring.py              # スコアリングロジック
  ├ filters.py              # フィルタリングロジック
  ├ live_performance.py     # 生演奏判定
  ├ seed_artists.py         # シードアーティストリスト
  └ main.py                 # エントリーポイント
```

### Spotify API 認証

Client Credentials Flow（ユーザー認証不要、公開データのみ）。

**エンドポイントの現状（2026-05-20 確認）:**
- `GET /search` — 正常
- `GET /artists/{id}` — 正常
- `GET /artists/{id}/top-tracks` — 正常
- `GET /audio-features` — **非推奨だが利用可能**（削除日未定）
- `GET /artists/{id}/related-artists` — **非推奨だが利用可能**（削除日未定）

### シードアーティスト（21名）

**海外（13名）:** Samantha Ballard、Israfelcello、Purpleschala、Harpsibored、Shea's Violin、John Oeth、mauricemori、Super Piano 64、Taylor Davis、insaneintherainmusic、Delldongo、Brooke Ferd、Super Guitar Bros

**国内（8名）:** 植松伸夫、光田康典、伊藤賢治、西木康智、崎元仁、菊田裕樹、SQUARE ENIX MUSIC、アトラスサウンドチーム

### スコアリング（5軸）

```
総合スコア = 認知度スコア × 0.25
           + 実力スコア   × 0.30
           + エモーション × 0.20
           + 配信安定性   × 0.15
           + 生演奏ボーナス（is_live_performance = true なら +10）
```

各スコアは 0〜100 で正規化。認知度はフェーズ1では popularity / monthly listeners で代替（将来 IGDB API 連携）。

### 実行フロー

```
1. シードアーティストを Spotify 上で検索 → Artist ID 解決
2. Related Artists で拡張（深度2、利用可能な場合）
3. アーティストフィルタリング（フォロワー数・generic名排除）
4. 各アーティストの Top Tracks 取得
5. ゲーム音楽カバー判定（楽曲名・アルバム名キーワード）
6. 生演奏判定（Audio Features + キーワード）
7. スコアリング
8. 総合スコア上位 100 曲を抽出
9. Supabase（music_curation）に upsert
```

### 完了条件

- `python/curation/` 配下に全モジュール実装済み
- 小規模テスト（3〜5名）成功
- 本実行で `music_curation` テーブルに 100 曲（最低 30 曲）投入済み
- 各楽曲にスコアと Audio Features が記録されている
- 管理画面 `/admin/music_curation` で一覧表示される

---

## Sprint 2: 週次 X 自動投稿フロー（未着手）

- `music_curation` から `status='accepted'` かつ未投稿のレコードを週1で取得
- `scheduled_posts` に登録（category='new_music'）
- ツイート文面生成（楽曲名・アーティスト・YouTube リンク・Amazon Music リンク）
- 既存の `post_scheduled_flow` で自動投稿

---

## 技術メモ

- `python/curation/` は Prefect フローには含めず、スタンドアロンスクリプトとして実行
- `python/.env` に `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` を追記
- `python/utils/config.py` に Spotify 認証情報を追加
- `spotipy` ライブラリを使用（pip install spotipy）
