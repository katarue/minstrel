# Session Start for Claude (Minstrel)

このファイルは **Claude.ai(Web/アプリ版)専用** のセッション開始ハブです。
Claude Code は `CLAUDE.md` を直接読むので、このファイルは不要です。

---

## このファイルの使い方(ムーチョ向け)

新規 Claude.ai セッションで以下を投げるだけ:

```
Minstrelプロジェクトの作業を継続します。
セッション開始プロトコルを実行してください。

https://raw.githubusercontent.com/katarue/minstrel/main/session_start_for_claude.md

【次にやること】
(ここに今回やることを書く)
```

これで Claude.ai は以下を順番に実行します:
1. このハブファイルを読む
2. 下記の必読ドキュメントを順番に web_fetch で読む
3. 3行サマリーを報告
4. 「次にやること」に着手

---

## ステップ1: 必読ドキュメントを順番に読み込む

以下のファイルを上から順番に web_fetch で読み込んでください。順序を飛ばしてはいけません。

### プロジェクト固有ルール

https://raw.githubusercontent.com/katarue/minstrel/main/CLAUDE.md

### メモリーバンク運用構造

https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/framework_overview.md

### メモリーバンク本体(以下の順序を厳守)

https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/active_context.md

https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/pending_decisions.md

https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/decision_log.md

https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/system_patterns.md

https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/progress.md

https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/rules.md

### 補助ドキュメント

https://raw.githubusercontent.com/katarue/minstrel/main/docs/folder_structure.md

https://raw.githubusercontent.com/katarue/minstrel/main/docs/project_plan.md

https://raw.githubusercontent.com/katarue/minstrel/main/docs/implementation_schedule.md

https://raw.githubusercontent.com/katarue/minstrel/main/docs/design_system.md

---

## ステップ2: 3行サマリーをムーチョに報告

必読ドキュメントを読み終えたら、以下の3行サマリーを必ず報告してから次の作業に進んでください:

- **既知の前提**: プロジェクト概要・現在のフェーズ
- **決定済みの関連事項**: 直近の重要な D-NN・主要な決定
- **未解決の関連事項**: 直近の重要な P-NN・現在のブロッカー

---

## ステップ3: 「次にやること」に着手

ムーチョが指示した「次にやること」に従って作業を進めてください。

**重要**:
- 不明点があれば実装前に必ず質問する(R-04)
- 過去の決定(D-NN)・未解決事項(P-NN)と矛盾する場合は指摘する(R-02)
- 提案の問題点・リスク・代替案を必ず指摘する(忖度禁止)

---

## ムーチョの基本情報

- **名前**: 宮内崇敏(ムーチョ)
- **役割**: ディレクター・意思決定者(コードは書かない)
- **Claude への期待**: 技術顧問・アーキテクト + ディレクションパートナー

---

## コミュニケーションルール

- 日本語の「です・ます調」で
- 過度な前置きやお世辞は排除、フラットで直接的に
- 結論先出し
- 一問一答形式で進める
- 1回の回答は2,000〜3,000文字以内
- 不明確な指示は推測せず確認質問する
- 忖度せず、提案の問題点・リスク・代替案を必ず指摘する
- Claude Code向けプロンプトは「全体を1つのコードブロックで囲わない」原則を厳守

---

## このファイルの更新

必読ドキュメントが追加・削除された場合、このファイルを更新する。
更新は通常の D-NN フローではなく、ファイル内容のリビジョン管理のみで運用する(R-NN ルール対象外)。
