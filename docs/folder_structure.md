# Minstrel フォルダ構造

このファイルは CLAUDE.md の PRE-FLIGHT CHECK で自動インポートされる。
リポジトリ構造に変更があった場合はこのファイルを更新すること。

**最終更新**: 2026-05-07

---

```
minstrel/                                ← リポジトリルート
│                                        ← C:\Users\katar\repos\active\minstrel\
├── .git/
├── .gitignore
├── .githooks/                           ← Git フック（未有効化・将来検討）
│   ├── post-commit                      ← Auto-push（feature/* のみ）
│   ├── pre-commit                       ← 機密ファイルブロック + R-DIR-01
│   └── pre-commit.ps1                   ← R-DIR-01 詳細チェック（PS1）
├── CLAUDE.md                            ← Claude Code 向けプロジェクトルール（このセッション全面改訂）
├── README.md
├── docs/
│   ├── project_plan.md                  ← プロジェクト計画書（戦略・哲学）
│   ├── implementation_schedule.md       ← フェーズ別実装スケジュール
│   ├── design_system.md                 ← デザインシステム定義
│   ├── folder_structure.md              ← このファイル
│   ├── investigation_2026-05-07.md      ← AI News Pipeline メモリーバンク調査報告書
│   └── memory_bank/                     ← Source of Truth（毎セッション更新）
│       ├── README.md
│       ├── active_context.md            ← 現在地（毎セッション更新）
│       ├── decision_log.md              ← 確定決定事項 D-NN 体系
│       ├── framework_overview.md        ← メモリーバンク運用構造（新規）
│       ├── handover_notes.md            ← 新規チャット引き継ぎ用
│       ├── pending_decisions.md         ← 未解決事項 P-NN 体系
│       ├── progress.md                  ← 作業履歴（時系列）
│       ├── rules.md                     ← R-NN ルール定義（新規）
│       ├── session_log.md               ← セッション開始/終了タイムスタンプ（新規）
│       └── system_patterns.md          ← アーキテクチャ・命名・規約
├── supabase/
│   └── migrations/                      ← DB マイグレーション（Supabase で実行済み）
│       ├── 20260507000001_create_initial_schema.sql
│       ├── 20260507000002_setup_rls_policies.sql
│       ├── 20260507000003_grant_anon_permissions.sql
│       └── 20260507000004_insert_test_data.sql
└── web/                                 ← Next.js サイト本体
    ├── .env.local                       ← gitignored（Supabase キー等）
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── postcss.config.mjs
    ├── eslint.config.mjs
    ├── vercel.json                      ← Vercel デプロイ設定
    ├── public/
    └── src/
        ├── app/
        │   ├── events/[id]/page.tsx     ← イベント詳細ページ
        │   ├── organizers/page.tsx      ← 演奏団体一覧
        │   ├── organizers/[id]/page.tsx ← 演奏団体詳細
        │   ├── titles/page.tsx          ← ゲームタイトル一覧
        │   ├── titles/[id]/page.tsx     ← ゲームタイトル詳細
        │   ├── globals.css              ← Tailwind テーマ定義 + リセット
        │   ├── layout.tsx               ← フォント読み込み、Header/Footer
        │   └── page.tsx                 ← トップページ（コンサート一覧）
        ├── components/
        │   ├── layout/
        │   │   ├── Header.tsx
        │   │   └── Footer.tsx
        │   └── ui/
        │       ├── Badge.tsx
        │       ├── Button.tsx
        │       └── Card.tsx
        └── utils/
            └── supabase/
                ├── client.ts
                ├── middleware.ts
                └── server.ts
```

---

## 禁止パターン（R-DIR-01）

以下の接尾辞をディレクトリ名・ファイル名に付けることを禁止する：

- `.NEW` / `.OLD`
- `_v2` / `_v3` 等の番号付きバージョン
- `_temp` / `_backup` / `_old` / `_new`

## 将来追加予定ディレクトリ

- `pipeline/` ← Python スクレイピングパイプライン（フェーズ2で追加）
