# Progress Log

Minstrelプロジェクトの作業記録（時系列）。

新しい作業は上に追加する（最新が上）。

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
