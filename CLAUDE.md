# CLAUDE.md - Minstrel

このファイルは Minstrel プロジェクト固有のルールと、セッション開始/終了プロトコルを定義する。
共通ルール（コミュニケーション、4原則）は `C:\Users\katar\CLAUDE.md` を参照。

---

## 🛑 MANDATORY PRE-FLIGHT CHECK

**新規セッション開始時に必ずこの順序で実行すること。順序を飛ばしてはいけない。**

```
CHECK 1: pwd + git remote -v でリポジトリを確認
         期待値: C:\Users\katar\repos\active\minstrel
                 origin → https://github.com/katarue/minstrel.git

CHECK 2: 禁止パスの非存在確認
         .NEW / .OLD / _v2 / _temp / _backup を含むパスがないか確認（R-DIR-01）

CHECK 3: git status でワーキングツリーがクリーンか確認

CHECK 4: @docs/folder_structure.md を読む（リポジトリ構造の把握）
```

---

## 📚 MANDATORY READING AT SESSION START

**作業開始前に memory_bank/ の以下を必ずこの順序で読み込む。**

```
1. docs/memory_bank/active_context.md   ← 現在地（最優先）
2. docs/memory_bank/pending_decisions.md ← 未解決事項
3. docs/memory_bank/decision_log.md     ← 確定決定事項
4. docs/memory_bank/system_patterns.md  ← アーキテクチャ・規約
5. docs/memory_bank/progress.md         ← 作業履歴
6. docs/memory_bank/rules.md            ← R-NN ルール定義
```

読み込み後、ムーチョに以下の3行サマリーを報告してから作業を開始する：
- 既知の前提
- 決定済みの関連事項
- 未解決の関連事項

---

## 🔍 BEFORE PROPOSING ANY ARCHITECTURE OR IMPLEMENTATION

設計・実装を提案する前に以下を必ず確認する：

1. `decision_log.md` — 同じ判断を D-NN として記録していないか
2. `pending_decisions.md` — 関連する P-NN がないか
3. 実装方針が `docs/implementation_schedule.md` のフェーズ・タスク番号と整合しているか
4. 変更箇所が `CLAUDE.md` の4原則（Surgical Changes）に従っているか

---

## 📝 SESSION END RITUAL

**CLOSING RITUAL の Gate 3 で実行する。以下の順序で更新すること。**

```
1. decision_log.md  （新しい D-NN を追記）
2. pending_decisions.md  （新しい P-NN を追記、解決済みは ✅ マーク）
3. progress.md  （今回のセッション作業を追記）
4. active_context.md  （現在地・次のステップを更新）
```

---

## 🚦 セッション開始プロトコル（SESSION START RULES）

**トリガー**: Claude Code セッション起動時

**手順**:

1. `docs/memory_bank/session_log.md` に開始タイムスタンプを記録
   ```
   YYYY-MM-DD HH:MM — SESSION OPEN
   ```
   **時刻省略禁止（日付のみは不可）**

2. MANDATORY PRE-FLIGHT CHECK（上記）を実行

3. `git branch --show-current` でブランチ確認
   - main の場合は警告: 「作業は feature/* または chore/* ブランチで行います」

4. MANDATORY READING AT SESSION START（上記）を実行

5. ムーチョに3行サマリーを報告してから作業を開始

---

## 🔒 セッション終了プロトコル（CLOSING RITUAL）

**トリガー**: ムーチョが「クロージングを始めて」または「セッション終了プロトコル」と発言

### Gate 1: 状態整理（報告のみ、実行しない）

以下を調査して報告する：

```
【Gate 1: 状態整理】
- 未コミット: X ファイル（ファイル名列挙）
- 未プッシュ: X コミット
- 未マージブランチ: X 本（ブランチ名列挙）
- セッション開始: YYYY-MM-DD HH:MM
```

### Gate 2: 判断確認（ムーチョの承認を得る）

各項目について以下3要素をセットで提示：

1. これは何か（一言説明）
2. なぜこの状態か（作業の経緯）
3. 推奨と理由

ムーチョの承認を得てから Gate 3 へ。

### Gate 3: 実行（クローズフェーズ）

1. 未コミット変更をコミット・プッシュ
2. SESSION END RITUAL（上記の4ファイルを順番に更新）
3. `session_log.md` に終了タイムスタンプを記録
   ```
   YYYY-MM-DD HH:MM — SESSION CLOSE
   作業内容の1行要約
   ```
   **時刻省略禁止**
4. Notion 開発日誌に短文追記（任意、parent page_id: `344cfe95-706a-81da-83d9-e6b693210d67`）
5. 「クロージング完了」を報告

---

## ⚡ AUTO-PUSH POLICY

**ステータス: 有効（2026-05-07〜）**

`git config core.hooksPath .githooks` 適用済み（D-026）。動作テスト完了。

バイパス（緊急時のみ）: `git commit --no-verify`（理由を memory-bank に記録すること）

有効化後の動作:
- `feature/*` ブランチ: コミット後に自動 push
- `main` / `chore/*`: 手動 push が必要

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
  - ポート: 3001（3000 ではない。Remotion と競合のため D-010）
  - 起動: cd web && npm run dev
  - ブラウザ: http://localhost:3001

AI 処理（将来フェーズ2で使用）:
  - Claude API（Anthropic）
  - 用途: 構造化抽出・要約・Vision 解釈

情報収集（将来フェーズ2で構築）:
  - Prefect（スケジューラー）
  - Python + BeautifulSoup

X 連携（将来フェーズ3）:
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
  chore/refactor-claude-md
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

タスク番号を末尾に併記すると履歴が追いやすい（例: `feat: イベント詳細ページ実装 (1-C-2)`）。

---

## ✅ Definition of Done

- TypeScript エラーなし（`npx tsc --noEmit`）
- ビルドエラーなし（`npm run build`）
- 対象ページがブラウザで想定どおりに動作する
- 未コミット変更なし
- 作業ブランチが main にマージ済み（または PR 作成済み）
- SESSION END RITUAL 完了

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

## 📚 必読ドキュメント

| ドキュメント | 内容 | 更新頻度 |
|---|---|---|
| `docs/project_plan.md` | 戦略・哲学 | 低 |
| `docs/implementation_schedule.md` | フェーズ別タスク | 適宜 |
| `docs/design_system.md` | デザイン規約 | 低 |
| `docs/memory_bank/` | Source of Truth | 毎セッション |

---

## このファイルの更新

Minstrel 固有のルール・設計が変わった場合、このファイルを更新する。
共通ルールはホームディレクトリの `C:\Users\katar\CLAUDE.md` を更新する。
ルール変更は R-07 に従い P-NN(meta) → D-NN(meta) のフローで管理する。

---

## Claude HQ システムへの移行(2026-05-08〜)

このプロジェクトは Claude HQ システムへ段階的に移行中。

### 新仕組みの基本

- **現在地**: STATE.md(リポジトリのルート、毎セッション上書き)
- **過去の決定の正本**: GitHub Issues(タイトル: `[decision] ...`、ラベル: `decision/adopted`)
- **判断基準**: このファイル(CLAUDE.md)の判断マトリクス

### 旧メモリーバンク(docs/memory_bank/)の扱い

**2026-05-08 以降、参照のみ・更新停止**

- 過去の決定確認のみ参照(D-001〜D-027)
- 新規決定は GitHub Issue で記録
- 新規セッションでは active_context.md / decision_log.md / progress.md を**更新しない**

### 新仕組みの全体像

詳細は以下を参照:
- ローカル: C:\Users\katar\repos\active\claude-hq\docs\ai_session_brief.md
- GitHub: katarue/claude-hq の docs/ai_session_brief.md

### 過去の決定を参照する手順

1. STATE.md の「関連 Issue」を確認
2. なければ GitHub Issues で `label:decision/adopted` で検索
3. 旧 D-NN で参照される古い決定は docs/memory_bank/decision_log.md を読んでもよい
4. ただし**新規決定は必ず Issue 起票**(旧 D-NN フォーマットは使わない)
