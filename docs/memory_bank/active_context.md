# Active Context

このファイルはMinstrelプロジェクトの「現在地」を示す。新規セッション開始時に必ず最初に読むこと。

**最終更新**: 2026年5月7日

---

## プロジェクト現在地

### フェーズ
**フェーズ1（基盤構築）の途中**

### 完了したセクション
- ✓ フェーズ0：準備（アカウント・APIキー取得）
- ✓ フェーズ1-A：DB構築（スキーマ作成・テーブル作成・RLS設定）
- ✓ フェーズ1-B：Next.js基盤（プロジェクト初期化・Tailwind・Supabase接続・デザイントーン・共通コンポーネント）

### 進行中
- なし（1-B-5完了、1-Cに着手前）

### 残タスク
- フェーズ1-A-3：テストデータ手動投入（後回し、1-Bと統合予定）
- フェーズ1-C：基本ページ実装（トップ詳細化、イベント詳細、団体ページ、タイトルページ、レスポンシブ）
- フェーズ1-D：仮公開（Vercelデプロイ、minstrel.live接続）
- フェーズ2以降：収集パイプライン構築

---

## 次の3ステップ

### ステップ1：1-A-3 / 1-C-1 統合（テストデータ + トップページ実装）

トップページに実データを表示する形で、テストデータ投入とトップページ実装を統合する。

具体的には：
- Supabaseに5〜10件のテストデータを手動投入（events、organizers、game_titles）
- トップページがSupabaseから実データを取得して表示するように改修

### ステップ2：1-C-2（イベント詳細ページ）

各イベントの個別ページを実装。動的ルーティング `/events/[id]` を使う。

### ステップ3：1-C-3（団体ページ）

演奏団体の一覧・詳細ページを実装。

---

## 現在のリポジトリ状態

- **mainブランチ**: 最新（1-B-5までの全変更がマージ済み）
- **未マージブランチ**: なし
- **未コミット変更**: なし
- **開発サーバーポート**: 3001

### 直近のコミット

```
ee0b06a chore: change dev server port to 3001
3dfc360 fix: resolve padding issue caused by unlayered global CSS reset
edb6552 fix: padding adjustments for page.tsx
712fa43 feat: トップページをデザインシステムに合わせて更新
4313318 feat: UI基本コンポーネント追加 Button/Card/Badge
3b8b024 feat: Header・Footerコンポーネント追加
a3b1152 feat: Tailwindテーマ定義とGoogle Fonts設定
edc67a7 docs: add design system specification
59cb393 feat: setup Supabase client and grant anon permissions
```

---

## 重要な注意事項

### 開発サーバー起動

```
cd C:\Users\katar\repos\active\minstrel\web
npm run dev
```

ブラウザで `http://localhost:3001` を開く（**3000ではない**）。

### 環境変数

`web/.env.local` に以下が設定されている（gitignored）：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Secret keyはまだ未使用（フェーズ2のPythonパイプラインで使用予定）。

### Supabase接続

- Project URL: `https://pobbxakrszuldyhyjrjp.supabase.co`
- 接続テストは1-B-3で完了している

### ブランチ運用

- 作業は必ず `feature/*` または `chore/*` ブランチで行う
- mainへの直接コミット禁止
- pre-commit hookは未導入（必要になれば追加）

---

## このセッションで完了したこと（2026-05-07）

1. プロジェクト計画策定〜Notion保存
2. GitHubリポジトリ作成・初期セットアップ
3. 3階層CLAUDE.md構成（ホーム・Minstrel・AI News Pipeline）
4. フェーズ1-A完了（DB構築）
5. フェーズ1-B完了（Next.js基盤・デザイン）
6. design_system.md作成
7. memory_bank構造を整備

## このセッション中に見つかった主要な罠

- Supabase publishable/secret keyの新方式（旧anon/service_roleキー）
- GRANT権限がCLI作成テーブルには自動付与されない
- globals.cssのCSSリセットが@layer baseで囲まれていないとTailwindユーティリティが効かない
- Next.jsのデフォルトポート（3000）がRemotionと競合
