# Memory Bank

このディレクトリはMinstrelプロジェクトの「外部記憶」として機能する。

## 目的

- AIアシスタント（Claude Code、チャットClaude）がセッションをまたいで一貫した判断を下せるようにする
- 過去の決定事項とその根拠を保持し、同じ議論を繰り返さない
- ムーチョさん自身が「あの時何を決めたか」を振り返るための参照資料
- チャット間の引き継ぎを確実にする

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `active_context.md` | 現在の状態と次の3ステップ。**毎セッション最初に読む** |
| `decision_log.md` | 確定した決定事項とその根拠（D-NN形式） |
| `pending_decisions.md` | 未解決の検討事項（P-NN形式） |
| `system_patterns.md` | アーキテクチャ、命名規則、ブランチ運用等の規約 |
| `progress.md` | セッションごとの作業記録（時系列） |
| `handover_notes.md` | 新規チャット開始時の引き継ぎ専用 |

## 使い方

### 新規セッション開始時（必読順序）

1. `active_context.md` - 今どこにいるか
2. `pending_decisions.md` - 未解決事項
3. `decision_log.md` - 過去の決定
4. `system_patterns.md` - 規約
5. `progress.md` - 直近の進捗

### セッション終了時

1. `decision_log.md` - 今日決めたことを追記
2. `pending_decisions.md` - 新たな保留事項を追記
3. `progress.md` - 今日の作業を時系列で追記
4. `active_context.md` - 現在地と次の3ステップを更新

### 新規チャットへの引き継ぎ時

`handover_notes.md` を更新してから、その内容を新規チャットに貼り付ける。

## ルール

- **記録の真実性**：曖昧な記憶ではなく、事実と判断を分けて記録する
- **理由を残す**：「何を決めたか」だけでなく「なぜそう決めたか」を残す
- **失敗も残す**：罠にハマった事例も記録し、再発を防ぐ
- **更新は躊躇しない**：状況が変わったら速やかに更新する

## 関連ドキュメント

- `docs/project_plan.md` - プロジェクト計画書（戦略・哲学）
- `docs/implementation_schedule.md` - 実装スケジュール
- `docs/design_system.md` - デザインシステム定義
- `CLAUDE.md` - Claude Code向け基本ルール
