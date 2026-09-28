# Minstrel フォルダ構造

このファイルは CLAUDE.md の PRE-FLIGHT CHECK で自動インポートされる（`@docs/folder_structure.md`）。
リポジトリ構造に大きな変更があった場合はこのファイルを更新すること。

**進捗・現在地は STATE.md（リポジトリ直下）が唯一の正本。このファイルはフォルダの地図であり、進捗は記載しない。**

**最終更新**: 2026-09-28

---

```
minstrel/                                ← リポジトリルート
│                                        ← C:\Users\katar\repos\active\minstrel\
├── .git/
├── .claude/
│   ├── hooks/                           ← SessionStart/Stop フック（STATE.md 自動読込・更新強制）
│   ├── rules/                           ← テーマ別ルール（*.md、CLAUDE.md 末尾の目次から参照）
│   └── settings.json                    ← permissions・hooks 設定
├── .githooks/                           ← post-commit（AUTO-PUSH等）、pre-commit（機密ファイルブロック等）
├── CLAUDE.md                            ← Claude Code 向けプロジェクトルール（必須ルールのみ）
├── README.md
├── STATE.md                             ← 進捗の正本（現在地・完了／判明した事実／次のステップ）
├── session_start_for_claude.md          ← Claude.ai（Web/アプリ版）専用のセッション開始ハブ
├── docs/
│   ├── operations.md                    ← 現行の運用状況（スクレイパー構成・パイプライン）← 最新
│   ├── design_system.md                 ← デザインシステム定義
│   ├── folder_structure.md              ← このファイル
│   ├── pipeline_design.md               ← 収集パイプラインの設計メモ
│   ├── issues/                          ← 個別 Issue の設計メモ
│   └── archive/                         ← 過去資料。現状と異なるため通常は参照しない（詳細は archive/README.md）
│       ├── project_plan.md              ← 初期プロジェクト計画書（戦略・哲学、2026年5月時点）
│       ├── implementation_schedule.md   ← 初期実装スケジュール（2026年5月時点、現状と乖離）
│       └── memory_bank/                 ← 旧メモリーバンク（D-NN/P-NN 体系、読み取り専用）
├── supabase/
│   └── migrations/                      ← DB マイグレーション（Supabase で実行済み、14件）
├── python/                              ← 情報収集パイプライン（Prefect + Python、自宅PCで稼働）
│   ├── flows/                           ← Prefect フロー定義
│   ├── scrapers/                        ← サイト別スクレイパー（詳細は docs/operations.md）
│   ├── processor/                       ← Claude API構造化抽出・要約
│   ├── validator/                       ← 機械検証（ルールベース判定）
│   ├── curation/                        ← 楽曲キュレーション収集
│   ├── utils/                           ← 共通ユーティリティ（DB接続・設定等）
│   ├── scripts/                         ← 個別メンテナンス・データ修正スクリプト
│   ├── run_scheduler.py                 ← Prefect スケジューラ起動
│   └── start_scheduler.ps1
└── web/                                 ← Next.js サイト本体
    ├── .env.local                       ← gitignored（Supabase キー等）
    ├── package.json / tsconfig.json / next.config.ts / vercel.json
    ├── public/
    └── src/
        ├── app/
        │   ├── [locale]/                ← 多言語対応ページ（next-intl）
        │   ├── admin/                   ← 管理画面（クッキーセッション認証）
        │   ├── api/                     ← API Routes
        │   ├── layout.tsx / globals.css
        │   └── sitemap.ts / robots.ts
        ├── components/
        │   ├── layout/                  ← Header / Footer
        │   └── ui/                      ← Badge / Button / Card 等
        ├── i18n/                        ← next-intl 設定
        ├── lib/                         ← session.ts（管理画面認証）等
        └── utils/
            └── supabase/                ← client.ts / middleware.ts / server.ts
```

---

## 禁止パターン（R-DIR-01）

以下の接尾辞をディレクトリ名・ファイル名に付けることを禁止する：

- `.NEW` / `.OLD`
- `_v2` / `_v3` 等の番号付きバージョン
- `_temp` / `_backup` / `_old` / `_new`
