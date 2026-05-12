# Handover Notes - 新規チャット引き継ぎ専用

このファイルは、新規チャットのClaudeに**最初のメッセージとして渡す**ことを想定した引き継ぎ文書。

最終更新：2026年5月7日（リポジトリpublic化に伴い、URL直接読み込み方式に更新）

---

## 重要な前提

Minstrelリポジトリは**public**になっている。これにより、新規チャットのClaude（チャットClaude）は`web_fetch`ツールで`raw.githubusercontent.com`経由でリポジトリ内のファイルを直接読める。

そのため、新規チャット開始時はURLを明示的に渡すだけでよく、ファイル内容のコピペは不要。

---

## 新規チャットへの最初のメッセージ（決定版）

以下を新規チャットの最初のメッセージとして送る。**そのままコピペでOK**。

````
Minstrelプロジェクトの作業を継続します。

リポジトリ：https://github.com/katarue/minstrel

【必読ドキュメント（順序厳守、すべてweb_fetchで読み込んでください）】

1. https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/active_context.md
2. https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/pending_decisions.md
3. https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/decision_log.md
4. https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/system_patterns.md
5. https://raw.githubusercontent.com/katarue/minstrel/main/docs/memory_bank/progress.md
6. https://raw.githubusercontent.com/katarue/minstrel/main/docs/project_plan.md
7. https://raw.githubusercontent.com/katarue/minstrel/main/docs/implementation_schedule.md
8. https://raw.githubusercontent.com/katarue/minstrel/main/docs/design_system.md
9. https://raw.githubusercontent.com/katarue/minstrel/main/CLAUDE.md

【私について】

私は宮内崇敏（ムーチョ）です。コードは書かず、意思決定とディレクションが役割です。
あなたには技術顧問・アーキテクト＋ディレクションパートナーとして接してほしいです。

【コミュニケーションルール】

- 日本語の「です・ます調」で
- 過度な前置きやお世辞は排除、フラットで直接的に
- 結論先出し
- 一問一答形式で進める
- 1回の回答は2,000〜3,000文字以内
- 不明確な指示は推測せず確認質問する
- 忖度せず、提案の問題点・リスク・代替案を必ず指摘する
- Claude Code向けプロンプトは「全体を1つのコードブロックで囲わない」原則を厳守

【次にやること】

active_context.mdの「次の3ステップ」を確認してください。
すべて読み終わったら、現状把握と次のアクション提案をしてください。
````

---

## なぜこの方式が機能するか

新規チャットのClaude（チャットClaude）は通常、ユーザーが明示的に共有したURL以外はweb_fetchできない（セキュリティ仕様）。

しかし、上記メッセージにURLを直接列挙することで、Claudeは「ユーザーが共有したURL」として認識し、各URLをfetchできる。

これにより：
- リポジトリの内容をコピペで貼り付ける必要がない（過去20万文字のコピペが必要だった問題を解消）
- 常に最新のドキュメントを読める
- メンテナンスはリポジトリ側で完結する

---

## トラブル時の参照先

### 「あれ、何決めたっけ？」
→ `decision_log.md` を検索

### 「これって決まってたっけ？」
→ `pending_decisions.md` も併せて確認

### 「過去にどんな実装をしたっけ？」
→ `progress.md` を時系列で遡る

### 「ルールを忘れた」
→ `system_patterns.md` を参照

### 「どんなデザインだっけ？」
→ `docs/design_system.md` を参照

### 「全体方針を見直したい」
→ `docs/project_plan.md` を参照

---

## メンテナンス指針

このhandover_notes.md自体は、以下のタイミングで更新する：

- 大きな方針転換があった時
- 新しい必読ドキュメントが追加された時
- コミュニケーションルールが変わった時
- 過去の罠が新たに発覚した時

通常のセッション完了時は、`progress.md`、`active_context.md`、`decision_log.md`、`pending_decisions.md` の更新で足りる。

このhandover_notes.mdの更新頻度は低くて良い（半年に1回程度の見直しで十分）。

---

## 引き継ぎが失敗するパターンと対策

### パターン1：「リポジトリを読みません」と言われる
**対策**: 最初のメッセージで「すべてweb_fetchで読み込んでください」と明記

### パターン2：要約しすぎて文脈が抜ける
**対策**: 要約禁止、原文を読ませる方針を明記

### パターン3：勝手に判断を変えられる
**対策**: decision_logの該当D-NN番号を明示的に参照させる

### パターン4：トーンがブレる
**対策**: コミュニケーションルールを最初に提示

### パターン5：URLが古くなる
**対策**: リポジトリ構造を変える時は、このhandover_notes.mdのURLも併せて更新

---

## 引き継ぎチェックリスト

新規チャット開始時、以下が確実に伝わっているか確認する：

### プロジェクトの基本
- [ ] Minstrelとは何か（ゲーム音楽コンサート情報ポータル）
- [ ] ターゲット（30〜50代男性中心）
- [ ] コンセプト（「ギルドの掲示板」）
- [ ] 現在のフェーズ（フェーズ1-Bまで完了、1-C着手前）

### 技術環境
- [ ] スタック（Next.js 15 + Supabase + Vercel + Prefect + Claude API）
- [ ] リポジトリの場所（C:\Users\katar\repos\active\minstrel）
- [ ] 開発ポート（3001、3000ではない）
- [ ] Supabase URL（pobbxakrszuldyhyjrjp.supabase.co）

### 重要な規約
- [ ] ブランチ運用（feature/*、chore/*）
- [ ] 命名規則（snake_case）
- [ ] CSSの@layer base ルール
- [ ] スクレイピング配慮ルール

### 過去の罠
- [ ] CSSの@layer問題（D-023）
- [ ] GRANT権限自動付与なし（D-019）
- [ ] ポート競合（D-010）
- [ ] Supabase新方式キー（D-018）

### コミュニケーションルール
- [ ] です・ます調
- [ ] 結論先出し
- [ ] 一問一答
- [ ] 忖度しない
- [ ] コードブロックネストしない
