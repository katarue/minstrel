# Framework Overview

Minstrel プロジェクトのメモリーバンク運用構造。

**このファイルの目的**: 次回セッションで Claude Code が記憶ゼロで起動した場合に、
このファイルだけ読めば「どこに何があるか」「どう作業を再開するか」が分かる状態を維持する。

最終更新: 2026-05-07（D-025: AI News Pipeline からの移植）

---

## 1. メモリーバンクの構造

```
docs/memory_bank/
├── active_context.md      ← 現在地（毎セッション更新）★最初に読む
├── pending_decisions.md   ← 未解決事項 P-NN（毎セッション確認）
├── decision_log.md        ← 確定決定事項 D-NN（参照・追記）
├── system_patterns.md     ← アーキテクチャ・命名・規約（変更時のみ更新）
├── progress.md            ← 作業履歴（毎セッション追記）
├── rules.md               ← R-NN ルール定義（変更時のみ更新）
├── session_log.md         ← セッション開始/終了タイムスタンプ
├── framework_overview.md  ← このファイル
├── handover_notes.md      ← 新規チャット引き継ぎ用（定期メンテ）
└── README.md
```

---

## 2. Multi-layer Memory 役割分担

| 層 | Source of Truth 対象 | 更新タイミング |
|---|---|---|
| **`docs/memory_bank/`（GitHub）** | プロジェクト全体のハブ、全決定事項 | 毎セッション |
| **Notion 開発日誌** | セッションの文脈・節目の記録 | 大きな節目 |
| **Claude Code auto-memory** | 会話コンテキストの補助記録 | 自動（管理不要） |

**原則**: memory_bank/ がハブ。memory_bank/ を読めば他の層のどこに何があるか辿れる状態を常に維持する。
逆に言えば、memory_bank/ から辿れない情報は存在しないのと同じ。

---

## 3. 情報の配置先判断フロー

新しい情報を記録する際は必ずこのフローに従う（R-06 準拠）:

1. 振る舞いルールか？ → `rules.md` に R-NN として追加
2. ルール自体の変更か？ → R-07 に従い `pending_decisions.md` に P-NN(meta) として起票
3. 現在のタスク・Next Steps か？ → `active_context.md`
4. 未解決の意思決定か？ → `pending_decisions.md` に P-NN
5. 確定した決定事項か？ → `decision_log.md` に D-NN
6. アーキテクチャ・技術規約か？ → `system_patterns.md`
7. 作業履歴・学びか？ → `progress.md`
8. どれにも該当しない → ムーチョに相談

---

## 4. セッション開始プロトコル（自己復旧手順）

**記憶ゼロで起動した Claude への手順**:

```
STEP 1: docs/memory_bank/session_log.md に開始タイムスタンプを記録
        形式: YYYY-MM-DD HH:MM — SESSION OPEN（時刻省略禁止）

STEP 2: PRE-FLIGHT CHECK（CLAUDE.md 参照）
        - pwd と git remote -v でリポジトリ確認
        - 禁止パス（.NEW, _v2 等）の非存在確認
        - git status でクリーンか確認
        - @docs/folder_structure.md を読む

STEP 3: git branch --show-current で現在のブランチ確認
        → main の場合は警告（作業は feature/* または chore/* で行う）

STEP 4: memory_bank/ の以下を順番に読む
        1. active_context.md  （現在地）
        2. pending_decisions.md（未解決）
        3. decision_log.md    （決定済み）
        4. system_patterns.md （規約）
        5. progress.md        （作業履歴）
        6. rules.md           （ルール）

STEP 5: ムーチョに3行サマリーを報告
        - 既知の前提
        - 決定済みの関連事項
        - 未解決の関連事項
```

---

## 5. セッション終了プロトコル（CLOSING RITUAL）

**トリガー**: ムーチョが「クロージングを始めて」または「セッション終了プロトコル」と発言

```
GATE 1: 状態整理（報告のみ、実行しない）
        - git status（未コミットファイル一覧）
        - git log origin/...HEAD（未プッシュコミット数）
        - git branch -a --no-merged main（未マージブランチ）
        - session_log.md の開始タイムスタンプ確認

GATE 2: 判断確認（ムーチョの承認を得る）
        各項目: 何か、なぜこの状態か、推奨と理由

GATE 3: 実行
        1. 未コミット変更をコミット・プッシュ
        2. SESSION END RITUAL:
           decision_log.md → pending_decisions.md → progress.md → active_context.md
           （この順序で更新）
        3. session_log.md に終了タイムスタンプを記録
           形式: YYYY-MM-DD HH:MM — SESSION CLOSE + 1行要約（時刻省略禁止）
        4. Notion 開発日誌に短文追記（任意）
        5. 「クロージング完了」を報告
```

---

## 6. 番号体系

| 体系 | 用途 | 現在の最大番号 |
|---|---|---|
| D-NN | 確定決定事項 | D-025（2026-05-07 時点） |
| P-NN | 未解決・保留中 | P-008（2026-05-07 時点） |
| R-NN | 基本ルール | R-08（R-DIR-07 含む） |

**D-NN / P-NN は Minstrel プロジェクト独立の番号体系。AI News Pipeline の番号とは無関係。**

---

## 7. Recall Policy（参照決定木）

| 質問の種類 | 参照先 |
|---|---|
| 現在のタスク・次の一手 | `active_context.md` → `pending_decisions.md` |
| 過去の決定の理由 | `decision_log.md` |
| 技術規約・アーキテクチャ | `system_patterns.md` |
| 直近の作業文脈 | `progress.md` |
| ルール・禁止事項 | `rules.md` |
| デザイン規約 | `docs/design_system.md` |
| 全体方針・哲学 | `docs/project_plan.md` |
| 実装スケジュール | `docs/implementation_schedule.md` |
| リポジトリ構造 | `docs/folder_structure.md` |
