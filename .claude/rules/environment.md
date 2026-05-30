# Environment & ドキュメント一覧

## 実行環境

```
リポジトリ: C:\Users\katar\repos\active\minstrel\
OS: Windows 11 Home

フロントエンド:
  - Next.js 15（App Router、Turbopack）/ TypeScript / Tailwind CSS v4
  - Vercel（Hobby プラン、本番公開済み）

データベース・ストレージ:
  - Supabase（PostgreSQL、500MB 無料枠）
  - Project URL: https://pobbxakrszuldyhyjrjp.supabase.co
  - Supabase Storage（画像はホットリンク禁止、自前保存）

開発サーバー:
  - ポート: 3001（3000 ではない。Remotion と競合のため）
  - 起動: cd web && npm run dev / ブラウザ: http://localhost:3001

AI 処理（フェーズ2）: Claude API（構造化抽出・要約・Vision 解釈）
情報収集（フェーズ2）: Prefect（スケジューラー）+ Python + BeautifulSoup
X 連携（フェーズ3）:
  - 収集: twitterapi.io（$0.15/1,000ツイート）
  - 投稿: X 公式 API v2 無料枠

ドメイン: minstrel.live
```

## ドキュメント一覧

| ドキュメント | 内容 | 更新頻度 |
|---|---|---|
| `docs/operations.md` | **現行の運用状況**（スクレイパー構成・パイプライン）← 最新 | 変更時 |
| `docs/project_plan.md` | 戦略・哲学 | 低 |
| `docs/implementation_schedule.md` | 初期計画書（現状と乖離あり、参照不要） | 更新停止 |
| `docs/design_system.md` | デザイン規約 | 低 |
| `docs/archive/memory_bank/` | 旧決定ログ D-001〜D-027（読み取り専用） | 更新停止 |
