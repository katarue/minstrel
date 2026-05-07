# Progress Log

Minstrelプロジェクトの作業記録（時系列）。

新しい作業は上に追加する（最新が上）。

---

## 2026-05-07（続き）：フェーズ1完了 + メモリーバンク移植

### 完了タスク

#### フェーズ1-C / 1-D 実装（前セッション）
- 1-A-3 / 1-C-1：テストデータ投入（8イベント・3演奏団体・4ゲームタイトル） + トップページ実データ表示
- 1-C-2：イベント詳細ページ `/events/[id]`
  - JST タイムゾーン対応の日付フォーマット（UTC メソッド + 9時間オフセット）
  - Badge / Image / Link 統合、notFound() 対応
- 1-C-3：演奏団体一覧・詳細ページ `/organizers`・`/organizers/[id]`
  - ヘッダーナビの「演奏団体」リンクを `/organizers` に更新
- 1-C-4：ゲームタイトル一覧・詳細ページ `/titles`・`/titles/[id]`
  - game_titles に genre カラムがないため series_name / publisher で代替
  - event_game_titles ネスト取得の型キャスト問題（flatMap で対処）
  - ヘッダーナビの「ゲームタイトル」リンクを `/titles` に更新
- 1-D：Vercel デプロイ（Root Directory: web、環境変数設定）
  - web/vercel.json に framework: "nextjs" のみ記載（rootDirectory はダッシュボード設定）
  - Vercel + Supabase 構成で本番公開完了

#### AI News Studio ダッシュボード連携
- `ai-news-video-pipeline/scripts/start_minstrel.bat` 作成（CRLF, ASCII only）
- `ai-news-video-pipeline/tools/home_server.py` に minstrel_start アクション追加
- `ai-news-video-pipeline/tools/home.html` に Minstrel 起動ボタン追加

#### メモリーバンク移植（D-025）
- `docs/memory_bank/session_log.md` 新規作成（空テンプレート）
- `docs/memory_bank/rules.md` 新規作成（R-01〜R-08、R-DIR-01〜07）
- `docs/memory_bank/framework_overview.md` 新規作成（運用構造・参照決定木）
- `docs/folder_structure.md` 新規作成（リポジトリ構造定義）
- `CLAUDE.md` 全面書き直し（AI News Pipeline 構造を Minstrel 用に移植、8点修正反映）
- `.githooks/post-commit`・`pre-commit`・`pre-commit.ps1` 配置（未有効化）
- `decision_log.md` に D-025 追記

#### Claude.ai セッション開始ハブ導入（D-027）
- `session_start_for_claude.md` をリポジトリルート直下に新規作成
- README.md に Claude.ai 向け案内を追記
- `decision_log.md` に D-027 追記
- Claude.ai はハブURL1つを提示するだけで必読ドキュメントを連鎖読み込みできる体制が整った

#### AUTO-PUSH 有効化（D-026）
- PR #1（`chore/memory-bank-port`）を main にマージ
- `git config core.hooksPath .githooks` で hooks 有効化
- `feature/auto-push-test` ブランチで動作テスト → `[post-commit] Pushed successfully` 確認
- テストブランチをローカル・リモートから削除
- `CLAUDE.md` の AUTO-PUSH POLICY ステータスを「有効（2026-05-07〜）」に更新
- `decision_log.md` に D-026 追記

### 発生した問題・学び

1. **game_titles に genre カラムなし**：タスク仕様に genre Badge の記述があったが、実テーブルには該当カラムが存在しない。series_name / publisher で代替した
2. **Supabase ネスト取得の TypeScript 型**：event_game_titles → events の型推論が配列型になる。`flatMap` キャスト必須
3. **vercel.json の rootDirectory 挙動**：web/vercel.json に rootDirectory: "web" を書くと web/web を探しに行くリスクがある。framework のみ記載が安全
4. **organizers/page.tsx のコミット漏れ**：1-C-3 完了コミット時に一覧ページが未コミットのまま残っていた。次ブランチ作業開始時に発覚して対処

### 次のセッションで進めること

1. フェーズ2：情報収集パイプライン構築（Prefect + Python スクレイピング）
2. minstrel.live ドメイン DNS 接続（Vercel Domains 設定）
3. ヘッダーの「コンサート一覧」「カレンダー」リンクを実ページに接続（カレンダーはフェーズ3）

---

## 2026-05-07：プロジェクト立ち上げ〜フェーズ1-B完了

### 完了タスク

#### 計画策定
- プロジェクト計画書策定（Notion保存）
- 実装スケジュール策定（Notion保存）
- 3社AI（Gemini/Grok/ChatGPT）からセカンドオピニオン取得
- 技術選定確定（Next.js 15 + Supabase + Vercel + Prefect）

#### フェーズ0：準備
- Supabase アカウント作成・プロジェクト作成
- Vercel アカウント作成
- Anthropic API Key取得
- twitterapi.io API Key取得
- X Developer API Key取得
- minstrel.live ドメイン取得
- GitHub minstrel リポジトリ作成

#### CLAUDE.md整備
- 3階層構成設計（ホーム・Minstrel・AI News Pipeline）
- ホームディレクトリのCLAUDE.md作成（秘書役）
- MinstrelのCLAUDE.md作成（プロジェクト固有）
- AI News PipelineのCLAUDE.mdを重複削除版にリファクタリング

#### フェーズ1-A：DB構築
- 1-A-1：DBスキーマSQL作成
  - 4テーブル（events, organizers, game_titles, event_game_titles）
  - streaming_priceはINTEGER→TEXTに変更
- 1-A-2：Supabase上でテーブル作成・実行
- 1-A-4：Row Level Security設定
  - anon用ポリシー（is_published=trueのみSELECT可）
  - service_roleはBYPASSRLS
  - authenticatedは未対応（P-002）
  - GRANT SELECT TO anon を追加マイグレーションで対応（D-019）

#### フェーズ1-B：Next.js基盤
- 1-B-1：Next.js 15プロジェクト初期化
  - web/ディレクトリ配下、TypeScript、ESLint、App Router、Turbopack
  - 当初@latestで16系がインストールされたため15に固定し直し
- 1-B-2：Tailwind CSS v4導入
- 1-B-3：Supabase接続設定
  - @supabase/supabase-js、@supabase/ssr導入
  - 接続テストでGRANT権限不足が発覚（D-019で対応）
- 1-B-4：デザイントーン決定
  - コンセプト「ギルドの掲示板」
  - カラーパレット「羊皮紙と深紅」
  - タイポグラフィ「クラシック書物」
  - ロゴ「剣＋ハープ」エンブレム
  - design_system.md作成（388行）
- 1-B-5：共通コンポーネント設計
  - Header / Footer / Button / Card / Badge作成
  - Tailwindテーマ・Google Fonts設定
  - トップページをデザインシステム反映
  - パディング問題発生 → globals.cssの@layer問題と判明（D-023）
  - ポート3001変更（D-010）

#### memory_bank整備
- AI News Pipelineを参考に簡略版を構築
- 6ファイル（README、active_context、decision_log、pending_decisions、system_patterns、progress、handover_notes）

### 主要な学びと罠

1. **Supabase publishable/secret key新方式**：従来のanon/service_roleとは別の体系。新規プロジェクトでは新方式が標準（D-018）
2. **GRANT権限の自動付与なし**：CLI経由で作成したテーブルにはanon roleへのGRANTが自動付与されない（D-019）
3. **CSSの@layer問題**：unlayered CSSがTailwindユーティリティに勝ってしまう（D-023）。`@layer base { }`で囲むのが必須
4. **ポート競合**：Next.jsデフォルトの3000はRemotionと競合。Minstrelは3001を使用（D-010）
5. **Markdownのコードブロックネスト**：プロンプト全体を1つのコードブロックで囲うとレンダリングが崩れる。外側を4つのバッククォートで囲うと回避可能

### 次のセッションで進めること

1. **1-A-3 / 1-C-1 統合**：Supabaseにテストデータ手動投入 + トップページの実データ表示化
2. **1-C-2**：イベント詳細ページ実装
3. **1-C-3**：演奏団体ページ実装

### このセッションの所感

- ムーチョさんとClaude Codeのダブルチェック体制が機能した（streaming_price型変更、GRANT問題対応など）
- design_system.mdの作成により、デザイン実装のブレが大幅に減った
- 1セッションで計画策定〜フェーズ1-B完了まで走り切れた
- memory_bank整備により、次回以降の引き継ぎが安定する見込み
