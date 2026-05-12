# CLAUDE.md - Minstrel

このファイルは Minstrel プロジェクト固有のルールを定義する。
共通ルール（コミュニケーション・4原則）は `C:\Users\katar\CLAUDE.md` 参照。

---

## 🛑 MANDATORY PRE-FLIGHT CHECK

**新規セッション開始時に必ずこの順序で実行すること。**

```
CHECK 1: pwd + git remote -v でリポジトリを確認
         期待値: C:\Users\katar\repos\active\minstrel
                 origin → https://github.com/katarue/minstrel.git

CHECK 2: 禁止パスの非存在確認
         .NEW / .OLD / _v2 / _temp / _backup を含むパスがないか確認

CHECK 3: git status でワーキングツリーがクリーンか確認

CHECK 4: @docs/folder_structure.md を読む（リポジトリ構造の把握）
```

---

## 🔍 BEFORE PROPOSING ANY ARCHITECTURE OR IMPLEMENTATION

設計・実装を提案する前に以下を必ず確認する：

1. GitHub Issues で `label:decision/adopted` を検索して同じ判断が既にないか確認
2. 実装方針が `docs/implementation_schedule.md` のフェーズ・タスク番号と整合しているか
3. 変更箇所が `CLAUDE.md` の4原則（Surgical Changes）に従っているか

---

## 🚦 セッション開始プロトコル

**トリガー**: Claude Code セッション起動時

1. MANDATORY PRE-FLIGHT CHECK を実行
2. `git branch --show-current` でブランチ確認
   - main の場合は警告: 「作業は feature/* または chore/* ブランチで行います」

---

## 🔒 セッション終了プロトコル（CLOSING RITUAL）

**トリガー**: ムーチョが「クロージングを始めて」または「セッション終了プロトコル」と発言

### Gate 1: 状態整理（報告のみ、実行しない）

```
【Gate 1: 状態整理】
- 未コミット: X ファイル（ファイル名列挙）
- 未プッシュ: X コミット
- 未マージブランチ: X 本（ブランチ名列挙）
```

### Gate 2: 判断確認（ムーチョの承認を得る）

各項目について以下3要素をセットで提示：(1) 何か (2) なぜこの状態か (3) 推奨と理由

### Gate 3: 実行

1. 未コミット変更をコミット・プッシュ
2. 重要な決定は GitHub Issue 起票（タイトル: `[decision] ...`、ラベル: `decision/adopted`）+ auto memory に記録
3. Notion 開発日誌に短文追記（任意、parent page_id: `344cfe95-706a-81da-83d9-e6b693210d67`）
4. 「クロージング完了」を報告

---

## 📌 記憶・決定の管理

- **記憶**: `~/.claude/projects/.../memory/` の auto memory に記録（セッション間で永続）
- **新規決定**: GitHub Issues 起票（タイトル: `[decision] ...`、ラベル: `decision/adopted`）
- **過去の決定（D-001〜D-027）**: `docs/archive/memory_bank/decision_log.md` を参照（読み取り専用）

---

## ⚡ AUTO-PUSH POLICY

**ステータス: 有効（2026-05-07〜）**

`git config core.hooksPath .githooks` 適用済み。動作テスト完了。

バイパス（緊急時のみ）: `git commit --no-verify`（理由を auto memory に記録すること）

有効化後の動作:
- `feature/*` ブランチ: コミット後に自動 push
- `main` / `chore/*`: 手動 push が必要

---

## 🗄️ Supabase 操作ルール

- **DML（SELECT / INSERT / UPDATE / DELETE）**: Claude Code が Python Supabase クライアント経由で直接実行する。ムーチョに SQL Editor の操作を依頼してはいけない。
- **DDL（CREATE TABLE / ALTER TABLE 等）**: PostgREST 経由では実行不可のため、ムーチョに Supabase SQL Editor での実行を依頼する。

```python
# DML の実行例（python/ ディレクトリで実行）
from utils.config import SUPABASE_URL, SUPABASE_SECRET_KEY
from supabase import create_client
db = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
db.table("events").delete().eq("id", some_id).execute()
```

---

## 📋 イベントデータ入力ルール

### 1公演 = 1レコードの原則

**複数の会場・日程にまたがるツアーは、必ず会場ごとに別レコードとして登録する。**

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

---

## 🖥️ Environment

```
リポジトリ: C:\Users\katar\repos\active\minstrel\
OS: Windows 11 Home

フロントエンド:
  - Next.js 15（App Router、Turbopack）
  - TypeScript
  - Tailwind CSS v4
  - Vercel（Hobby プラン、本番公開済み）

データベース・ストレージ:
  - Supabase（PostgreSQL、500MB 無料枠）
  - Project URL: https://pobbxakrszuldyhyjrjp.supabase.co
  - Supabase Storage（画像はホットリンク禁止、自前保存）

開発サーバー:
  - ポート: 3001（3000 ではない。Remotion と競合のため）
  - 起動: cd web && npm run dev
  - ブラウザ: http://localhost:3001

AI 処理（フェーズ2）:
  - Claude API（Anthropic）
  - 用途: 構造化抽出・要約・Vision 解釈

情報収集（フェーズ2）:
  - Prefect（スケジューラー）
  - Python + BeautifulSoup

X 連携（フェーズ3）:
  - 収集: twitterapi.io（$0.15/1,000ツイート）
  - 投稿: X 公式 API v2 無料枠

ドメイン: minstrel.live
```

---

## 🌿 Branch Rules

```
作業ブランチ: feature/*  または  chore/*
本番ブランチ: main（直接コミット禁止）
命名例:
  feature/setup-supabase-schema
  feature/scraper-2083web
  chore/update-readme
  fix/padding-issue
```

---

## 📋 Git Commit Rules

Conventional Commits 規約に従う：

```
feat:      新機能
fix:       バグ修正
docs:      ドキュメント変更
chore:     雑務（設定変更等）
refactor:  リファクタリング
test:      テスト
```

---

## ✅ Definition of Done

- TypeScript エラーなし（`npx tsc --noEmit`）
- ビルドエラーなし（`npm run build`）
- 対象ページがブラウザで想定どおりに動作する
- 未コミット変更なし
- 作業ブランチが main にマージ済み（または PR 作成済み）

---

## 📐 プロジェクト概要

**プロジェクト名**: Minstrel — Game Music Concert Portal
**ドメイン**: minstrel.live
**ステータス**: フェーズ1完了・本番公開済み

日本国内のゲーム音楽コンサート情報を網羅的に収集・掲載する専門ポータルサイト。
情報の自動収集・機械検証・検索/フィルタ機能・カレンダー連携・X 自動投稿までを含む
フルオートメーション運用が最終目標。

---

## 🎨 設計原則

### 自動化の哲学
完全自動化 ＝「全部自動公開する」ではなく、**「人間が見なくても事故らない仕組み」**。

### 情報源ランク制
- **A ランク**（公式サイト・公式 X・公式チケット販売）→ 自動公開対象
- **B ランク**（2083WEB・note まとめ等）→ 補助情報・手動確認推奨
- **C ランク**（一般ユーザー投稿等）→ 発見用、公開ソースにしない

### 機械検証
AI による「ファクトチェック」ではなく、ルールベースの「機械検証」を行う。
条件を満たした場合のみ `auto_publish_eligible=true` とする。

### 70 点の網羅性、95 点の安全性
取りこぼしを許容する。間違った情報を載せるくらいなら載せない。

---

## ⚖️ 著作権・法務対応（重要）

- 公式サイト・チケットサイトの画像をホットリンクしない
- 画像は Supabase Storage に自前保存してから配信
- description は AI 要約 100〜200 字。原文コピー禁止
- 全イベント詳細ページに「公式情報を見る」リンクを必須配置
- 権利者からの削除要請に即時対応できる体制を維持

---

## 🏷️ ブランド・命名

- **ブランド名**: Minstrel（単数形、固定）
- **サブタイトル**: Game Music Concert Portal（英語固定）
- **ドメイン**: minstrel.live
- 表記ゆれ禁止（minstrels、Minstrels、ミンストレル等は使わない）

---

## 📚 ドキュメント一覧

| ドキュメント | 内容 | 更新頻度 |
|---|---|---|
| `docs/project_plan.md` | 戦略・哲学 | 低 |
| `docs/implementation_schedule.md` | フェーズ別タスク | 適宜 |
| `docs/design_system.md` | デザイン規約 | 低 |
| `docs/archive/memory_bank/` | 旧決定ログ D-001〜D-027（読み取り専用） | 更新停止 |

---

## このファイルの更新

Minstrel 固有のルール・設計が変わった場合、このファイルを更新する。
共通ルールはホームディレクトリの `C:\Users\katar\CLAUDE.md` を更新する。
新規決定は GitHub Issue 起票（label: `decision/adopted`）で記録する。
