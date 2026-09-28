# CLAUDE.md - Minstrel

このファイルは Minstrel プロジェクト固有の**必須ルールと全体像のみ**を記載する。

- 共通ルール（コミュニケーション・4原則・基本 Git 運用）→ `C:\Users\katar\CLAUDE.md`
- 詳細ルール（テーマ別）→ 末尾「詳細ルール目次」の `.claude/rules/*.md` を参照

---

## 🛑 Pre-Flight Check（最初に必ず）

新規セッション開始時、ファイル操作の前に必ず実行する。

1. `pwd && git remote -v` → `…/active/minstrel`、origin が `minstrel.git` であること
2. 禁止パス（`.NEW` `.OLD` `_v2` `_temp` `_backup`）の非存在確認
3. `git status` でワーキングツリーがクリーンか確認
4. @docs/folder_structure.md を読む

詳細 → `.claude/rules/preflight_check.md`

---

## 📐 プロジェクト概要

**Minstrel — Game Music Concert Portal** / ドメイン: minstrel.live / ステータス: フェーズ1完了・本番公開済み

日本国内のゲーム音楽コンサート情報を網羅的に収集・掲載する専門ポータル。情報の自動収集・機械検証・検索/フィルタ・カレンダー連携・X 自動投稿までを含むフルオートメーション運用が最終目標。

---

## 🔁 セッション運用

**進捗の正本は STATE.md（このリポジトリ直下）の1か所だけ。** 合言葉やクロージング手順を覚えていなくても記録が残ることを最優先にした設計。

**開始時:** Pre-Flight Check → `git branch --show-current`（main なら feature/* または chore/* へ誘導）。SessionStart フックが STATE.md の「現在地」を自動でコンテキストに読み込む（`.claude/hooks/session_start.ps1`）。

**アーキ・実装を提案する前:** GitHub Issues で `label:decision/adopted` を検索し過去判断を確認。`docs/implementation_schedule.md` のフェーズと整合を確認。

**進捗の記録（最重要・作業を1つ終えるたび）:** STATE.md の「現在地」（完了／判明した事実／進行中／次のステップ）を更新し、同じコミットに含める。STATE.md は「今の状態」を書く場所であり、古くなった記述は消すか書き換える。追記を積み上げるだけにせず、全体で約150行以内を目安に保つ。
Stop フックが、STATE.md 以外の変更（未コミット含む）や新しいコミットがあるのに STATE.md が未更新のまま終了しようとした場合を検知し、更新を促す（`.claude/hooks/stop_check.ps1`）。このため次項のクロージングは任意の確認手順であり、実行しなくても記録は残る。

**記録先（1か所ずつ・用途固定）:**

| 記録先 | 用途 |
|---|---|
| `STATE.md`（このリポジトリ） | 進捗の正本。唯一の「今の状態」の記録場所 |
| GitHub Issues（`decision/adopted`） | 決定事項の記録専用 |
| auto memory | 進捗は書かない（PC ごとの保存で他PC・claude.ai から見えないため） |
| ~~Notion 開発日誌~~ | 廃止。記録しない |

**終了時（任意）:** `.claude/rules/closing_ritual.md` の確認手順を使ってもよい（無くても記録は残る）。

詳細（アーキ提案前チェック・記録管理・AUTO-PUSH・DoD・コミット規約）→ `.claude/rules/session_workflow.md`

---

## 🎨 設計原則（意思決定の核）

**自動化の哲学:** 完全自動化＝「全部自動公開」ではなく、**「人間が見なくても事故らない仕組み」**。

**情報源ランク制:**

- **A ランク**（公式サイト・公式 X・公式チケット販売）→ 自動公開対象
- **B ランク**（2083WEB・note まとめ等）→ 補助情報・手動確認推奨
- **C ランク**（一般ユーザー投稿等）→ 発見用、公開ソースにしない

**機械検証:** AI の「ファクトチェック」ではなくルールベースの「機械検証」。条件を満たした場合のみ `auto_publish_eligible=true`。

**70点の網羅性、95点の安全性:** 取りこぼしは許容する。間違った情報を載せるくらいなら載せない。

---

## ⚖️ 著作権・法務対応（最高優先度・遵守必須）

- 公式サイト・チケットサイトの画像をホットリンクしない
- 画像は Supabase Storage に自前保存してから配信
- description は AI 要約 100〜200 字。原文コピー禁止
- 全イベント詳細ページに「公式情報を見る」リンクを必須配置
- 権利者からの削除要請に即時対応できる体制を維持

---

## 🏷️ ブランド・命名

- **ブランド名**: Minstrel（単数形、固定） / **サブタイトル**: Game Music Concert Portal（英語固定） / **ドメイン**: minstrel.live
- 表記ゆれ禁止（minstrels、Minstrels、ミンストレル等は使わない）

---

## 📑 詳細ルール目次（`.claude/rules/`）

| ファイル | 内容 |
|---------|------|
| `preflight_check.md` | Pre-Flight Check 詳細 |
| `session_workflow.md` | セッション開始/アーキ提案前/記録先/Git運用(AUTO-PUSH/DoD/コミット規約) |
| `closing_ritual.md` | クロージング3ゲート手順 |
| `environment.md` | 実行環境・ドキュメント一覧 |
| `data_operations.md` | Supabase 操作・イベントデータ入力ルール |

固有のルール・設計が変わったら本ファイルまたは該当 rules ファイルを更新する。共通ルールはホームの `C:\Users\katar\CLAUDE.md` を更新する。新規決定は GitHub Issue 起票（`decision/adopted`）。
