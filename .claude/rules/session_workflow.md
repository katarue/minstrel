# Session Workflow（セッション運用の詳細）

CLAUDE.md 本体「セッション運用」の詳細版。

## セッション開始プロトコル

トリガー: Claude Code セッション起動時。

1. Pre-Flight Check を実行（`preflight_check.md`）
2. `git branch --show-current` でブランチ確認
   - main の場合は警告:「作業は feature/* または chore/* ブランチで行います」

## アーキテクチャ・実装を提案する前に

1. GitHub Issues で `label:decision/adopted` を検索し、同じ判断が既にないか確認
2. 実装方針が `docs/implementation_schedule.md` のフェーズ・タスク番号と整合しているか
3. 変更箇所が 4 原則（Surgical Changes）に従っているか

## 記憶・決定の管理

- **記憶**: `~/.claude/projects/.../memory/` の auto memory に記録（セッション間で永続）
- **新規決定**: GitHub Issues 起票（タイトル `[decision] ...`、ラベル `decision/adopted`）
- **過去の決定（D-001〜D-027）**: `docs/archive/memory_bank/decision_log.md` を参照（読み取り専用）

## Git 運用

### AUTO-PUSH POLICY（有効: 2026-05-07〜）

`git config core.hooksPath .githooks` 適用済み。

- `feature/*` ブランチ: コミット後に自動 push
- `main` / `chore/*`: 手動 push が必要
- バイパス（緊急時のみ）: `git commit --no-verify`（理由を auto memory に記録）

### ブランチ運用（minstrel 固有）

- コミット後は即 push してデプロイ（Vercel）を確実に反映させる
- ※ feature/chore/main 直接コミットの基本方針はグローバル CLAUDE.md を参照

### Commit メッセージ規約

Conventional Commits に従う（`feat` / `fix` / `docs` / `chore` / `refactor` / `test`）。

### Definition of Done

- TypeScript エラーなし（`npx tsc --noEmit`）
- ビルドエラーなし（`npm run build`）
- 対象ページがブラウザで想定どおり動作する
- 未コミット変更なし
- 作業ブランチが main にマージ済み（または PR 作成済み）
