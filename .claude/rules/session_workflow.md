# Session Workflow（セッション運用の詳細）

CLAUDE.md 本体「セッション運用」の詳細版。

## セッション開始プロトコル

トリガー: Claude Code セッション起動時。

1. SessionStart フック（`.claude/hooks/session_start.ps1`）が STATE.md の「現在地」セクションを自動でコンテキストに追加する。合言葉やムーチョの記憶に頼らず、何もしなくても最新の状態が読み込まれる
2. Pre-Flight Check を実行（`preflight_check.md`）
3. `git branch --show-current` でブランチ確認
   - main の場合は警告:「作業は feature/* または chore/* ブランチで行います」

## アーキテクチャ・実装を提案する前に

1. GitHub Issues で `label:decision/adopted` を検索し、同じ判断が既にないか確認
2. 現行の運用実態（`docs/operations.md`）と矛盾しないか確認
3. 変更箇所が 4 原則（Surgical Changes）に従っているか

## 進捗・決定の記録

進捗の正本は **このリポジトリの STATE.md 1か所だけ**。記録先を分散させない。

- **進捗（今の状態）**: STATE.md の「現在地」を更新。作業を1つ完了して報告するたびに、同じコミットに含める。追記を積み上げず、古い記述は消すか書き換えて全体を約150行以内に保つ
- **新規決定**: GitHub Issues 起票（タイトル `[decision] ...`、ラベル `decision/adopted`）専用。進捗は書かない
- **auto memory**: 進捗は書かない（PC ごとの保存で他PC・claude.ai から見えないため、進捗の正本にはできない）
- **Notion 開発日誌**: 廃止。記録しない
- **過去の決定（D-001〜D-027）**: `docs/archive/memory_bank/decision_log.md` を参照（読み取り専用）

STATE.md 以外に変更があるのに STATE.md が未更新のまま終了しようとすると、Stop フック（`.claude/hooks/stop_check.ps1`）が検知して更新を促す。仕組みで担保しているため、クロージング手順（`closing_ritual.md`）は任意の確認用であり必須ではない。

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
