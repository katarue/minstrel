# System Patterns

Minstrelプロジェクトのアーキテクチャ、命名規則、運用規約をまとめたもの。

---

## 1. リポジトリ構造

```
minstrel/
├── .git/
├── .gitignore
├── README.md
├── CLAUDE.md                    ← Minstrel固有のClaude Code向けルール
├── docs/
│   ├── project_plan.md          ← プロジェクト計画書（戦略・哲学）
│   ├── implementation_schedule.md ← 実装スケジュール
│   ├── design_system.md         ← デザインシステム定義
│   └── memory_bank/             ← 外部記憶（このディレクトリ）
│       ├── README.md
│       ├── active_context.md
│       ├── decision_log.md
│       ├── pending_decisions.md
│       ├── system_patterns.md   ← このファイル
│       ├── progress.md
│       └── handover_notes.md
├── supabase/
│   └── migrations/              ← DBスキーマ・RLS・GRANT
│       ├── 20260507000001_create_initial_schema.sql
│       ├── 20260507000002_setup_rls_policies.sql
│       └── 20260507000003_grant_anon_permissions.sql
└── web/                         ← Next.jsサイト本体
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── postcss.config.mjs
    ├── eslint.config.mjs
    ├── .env.local               ← gitignored
    ├── public/
    └── src/
        ├── app/
        │   ├── globals.css      ← Tailwindテーマ定義 + リセット
        │   ├── layout.tsx       ← フォント読み込み、Header/Footer配置
        │   └── page.tsx         ← トップページ
        ├── components/
        │   ├── layout/
        │   │   ├── Header.tsx
        │   │   └── Footer.tsx
        │   └── ui/
        │       ├── Button.tsx
        │       ├── Card.tsx
        │       └── Badge.tsx
        └── utils/
            └── supabase/
                ├── server.ts
                ├── client.ts
                └── middleware.ts
```

将来の拡張：
- `pipeline/` ← Pythonスクレイピングパイプライン（フェーズ2で追加）

---

## 2. 命名規則

### 2-1. 一般

- ファイル名・ディレクトリ名：`snake_case`（小文字 + アンダースコア）
- ただしReactコンポーネントは慣例で`PascalCase`（Header.tsx、Button.tsx）
- DBテーブル名・カラム名：`snake_case`

### 2-2. ブランド名

- 正式名：**Minstrel**（単数形、固定）
- サブタイトル：**Game Music Concert Portal**（英語固定）
- 表記揺れ禁止（minstrels、Minstrels、ミンストレル等は使わない）

### 2-3. ドメイン

- 公式ドメイン：minstrel.live
- 開発環境：localhost:3001（**3000ではない**）

### 2-4. 環境変数

- すべて大文字 + アンダースコア
- Next.js公開用は `NEXT_PUBLIC_` プレフィックス必須
- 例：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

---

## 3. ブランチ運用

### 3-1. 基本ルール

- 作業は必ず `feature/*` または `chore/*` ブランチで行う
- mainブランチへの直接コミット禁止
- 作業開始前に `git status` がクリーンであることを確認

### 3-2. ブランチ命名

```
feature/setup-supabase-schema
feature/scraper-2083web
chore/update-readme
chore/refactor-claude-md
fix/padding-issue
docs/add-design-system
```

### 3-3. マージ方針

- featureブランチ完了 → mainにマージ → push
- マージ後は当該ブランチをローカル・リモート両方で削除
- pre-commit hookやauto-pushフックは当面導入しない

### 3-4. コミットメッセージ

Conventional Commits規約に従う：

- `feat:` 新機能
- `fix:` バグ修正
- `docs:` ドキュメント変更
- `chore:` 雑務（設定変更等）
- `refactor:` リファクタリング
- `test:` テスト

例：`feat: setup Supabase client and grant anon permissions (1-B-3)`

タスク番号（実装スケジュール）を併記すると履歴が追いやすい。

---

## 4. データベース設計の哲学

### 4-1. 情報源ランク制

```sql
source_rank: 'A' | 'B' | 'C'
```

- A：公式情報（自動公開対象）
- B：補助情報（手動確認推奨）
- C：発見用（公開ソースにしない）

### 4-2. 自動公開フラグ

```sql
auto_publish_eligible: boolean
is_published: boolean
```

- `auto_publish_eligible`：機械検証を通過したか
- `is_published`：実際に公開されているか
- 両方trueの時のみanonユーザーに見える（RLS制御）

### 4-3. 機械検証（フェーズ2で実装予定）

AIに最終判定させない。ルールベースの検証ロジックを通す：
- 必須項目チェック
- 日時妥当性
- 重複検知（duplicate_group_id）
- 中止・延期キーワード検知
- source_rank判定
- confidence_score計算

### 4-4. RLS（Row Level Security）

- anon：is_published=trueのレコードのみSELECT可能
- service_role：すべて可能（Pythonパイプラインから書き込み用）
- authenticated：明示ポリシーなし（フェーズ6で追加予定、P-002）

---

## 5. Webデザインの規約

詳細は `docs/design_system.md` を参照。

### 5-1. カラー

- `--color-parchment`：#F5EFE0（背景メイン）
- `--color-parchment-dark`：#EBE2CC（背景サブ）
- `--color-bordeaux`：#722F37（メイン）
- `--color-gold`：#B89D5E（アクセント）
- `--color-ink-body`：#3B2F1D（本文）
- `--color-ink-heading`：#1F1A12（見出し）

### 5-2. フォント

- 見出し：Cinzel + Noto Serif JP
- 本文：EB Garamond + Noto Serif JP

### 5-3. レイアウト

- パディング：PC 80px / タブレット 32px / SP 16px
- 角丸：4〜8px
- 影：軽い茶色系（rgba(59, 47, 29, 0.12)）

### 5-4. CSS規約（重要）

**globals.css のCSSリセットは必ず `@layer base { }` で囲む**。  
unlayered CSSはTailwindユーティリティに勝ってしまい、px-*やmx-autoが無効化される。これは1-B-5実装中に発覚した重要な罠（D-023参照）。

---

## 6. スクレイピング配慮

詳細は `docs/project_plan.md` 12-4 を参照。

- レート制限：最低5秒/リクエスト
- User-Agent：`Mozilla/5.0 (compatible; ConcertInfoBot/1.0)`
- robots.txt遵守
- 過去データ一括取得時は深夜帯に実行
- 定期収集は3日に1回

---

## 7. Modal安全ルール（共通）

ホームディレクトリのCLAUDE.mdから継承：

- min_containers=1絶対禁止、常に0
- テスト前にコスト明示
- クレジット残高確認
- モデルダウンロードはCPU-only関数で実施

---

## 8. システム構築方針

- 可能な限りクラウドで完結する設計を優先（macOS・Windows両環境対応のため）
- 自宅PC（katarue）依存部分は失敗通知をDiscord/メールに飛ばす

---

## 9. ローカル開発環境

### 9-1. リポジトリの場所

`C:\Users\katar\repos\active\minstrel\`

### 9-2. 開発サーバー起動

```
cd C:\Users\katar\repos\active\minstrel\web
npm run dev
```

ブラウザで http://localhost:3001 を開く。

### 9-3. ビルド・テスト

```
cd web
npm run build  # 本番ビルド
npm run lint   # ESLint
```

### 9-4. SSH経由のリモート開発

ノートPC（Mac、ktremch）から自宅PC（Windows、katarue）にSSH経由で開発する場合：
- VS Code Remote-SSH拡張を使用
- 1セッション = 1プロジェクトの原則
- 並行作業は別ウィンドウを開く（File → New Window）

---

## 10. AI News Pipelineとの連携

このプロジェクトはAI News Pipelineと別リポジトリだが、以下を共有：

- 自宅PC（katarue）のPrefect環境（localhost:4200）
- ホームディレクトリのCLAUDE.md（共通ルール）
- ムーチョさんの開発スタイル

将来的な統合可能性：
- B-roll自動取得パイプラインの共通化（P-004）
- 動的画像生成ロジックの共有

---

## 11. 進捗管理

### 11-1. ドキュメント

- `docs/project_plan.md` ：戦略・哲学（あまり更新しない）
- `docs/implementation_schedule.md` ：フェーズ・タスク（適宜更新）
- `docs/memory_bank/active_context.md` ：現在地（毎セッション更新）
- `docs/memory_bank/progress.md` ：作業履歴（毎セッション追記）

### 11-2. Notion同期

主要ドキュメントはNotion側にもミラーされている：
- 「Webサービス企画」配下に「Minstrel プロジェクト計画書」「Minstrel 実装スケジュール」

memory_bankはGitHubが正、Notionはあくまでムーチョさん閲覧用。
