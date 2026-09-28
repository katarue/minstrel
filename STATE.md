# STATE - Minstrel

最終更新: 2026-09-28

## 現在のフェーズ

本番公開済み(minstrel.live / Vercel)。コスト削減改修は完了・push済み(6ccc681)。自動収集の再開はムーチョの指示待ち(下記「現在地」参照)

## 現在地(2026-09-28 時点)

### 完了
- 管理画面ログインのクッキー化(a8712f4)、URL取得不具合2件修正(5f99f95)、コスト削減改修(6ccc681)
- 進捗記録の一元化: STATE.md を唯一の正本にし、SessionStart/Stop フック(`.claude/hooks/`)で自動読込・更新強制を実装。Notion開発日誌は廃止
- Stop フックの不具合2件を修正・実機確認済み: (1) セッション開始前からの未コミット変更を「今回の変更」と誤判定する問題 → SessionStart で未コミット変更の内容ハッシュをベースライン記録し、Stop 側は差分のみ判定 (2) `exit 2` が実際にはブロックしない問題 → Windows PowerShell 5.1 で `powershell -Command "& script.ps1"` 経由だと子スクリプトの exit code が伝播しない癖が原因と特定、settings.json のコマンド末尾に `; exit $LASTEXITCODE` を追加
- **ドキュメント一斉整理(STATE.md への正本一本化に伴う矛盾解消)**:
  - `docs/project_plan.md` `docs/implementation_schedule.md` を `docs/archive/` へ移動(現状と乖離した初期計画書のため。有効な方針は CLAUDE.md「設計原則」に集約済み)
  - `docs/.claude/settings.json`(入れ子の古い設定ファイル)を削除
  - `docs/folder_structure.md` を現在の実際の構造に合わせて全面書き直し(memory_bank を Source of Truth とする旧記述・実在しないファイル参照を削除)
  - `session_start_for_claude.md` を STATE.md + CLAUDE.md を案内するだけの短い内容に書き直し(旧 memory_bank 読み込み手順を削除)
  - CLAUDE.md・`session_workflow.md`・`environment.md` から `docs/implementation_schedule.md` への「整合確認」指示を削除(→ `docs/operations.md` に統一)。矛盾(session_workflow.mdは参照指示、environment.mdは参照不要、と食い違っていた)を解消
  - `docs/archive/README.md` を新規作成、`docs/archive/memory_bank/README.md` 冒頭に「過去資料・参照しない」の警告を追記
  - `.claude/settings.json`: `additionalDirectories` の旧 claude-hq パス3件を削除。`permissions.allow` から一度きりのコマンド(特定PID操作、旧ポート3000決め打ち、特定タスクID一時ファイル読み取り等、計約20件)を削除
  - `python/.gitignore` に `_test_*.py` を追加

### 判明した事実
- Prefectサーバー起動不具合の真因は共有DB(`~/.prefect/prefect.db`)のAlembicリビジョンが ai-news-video-pipeline側の古いprefectパッケージ(3.6.29)で解決できないこと(ミンストレル側の3.7.0が先行)。対応方針は要判断
- PowerShellの実運用ハマりポイント3件: (1) `.ps1`に日本語を含む場合UTF-8 BOM必須 (2) `@(cmd) | Where-Object` は結果1件でスカラー文字列に潰れる(`@(cmd | Where-Object {...})`と括ること) (3) `powershell -Command "& script.ps1"` だと子スクリプトの `exit N` が伝播しない(`-File` 起動か `; exit $LASTEXITCODE` で対処)
- コストの主因は「登録済みイベントも毎日 AI(Haiku)で読み直していた」ことだった(改修済み)
- `.claude/settings.json` に `Bash(*)` `PowerShell(*)` の全許可が既に存在し、個別の Bash/PowerShell 許可エントリは実質無効化されていた(今回は明らかに一度きりのものだけ削除。WebFetch/Read 等の個別許可は別名前空間のため引き続き有効)

### 進行中
- なし(本セッションの変更はすべて実機確認・grep確認済み。コミット待ち)

### 次のステップ
1. 本セッションの変更をコミット・push(ムーチョの指示待ち)
2. Prefectバージョン不整合への対応方針を決める((a)video-pipeline側prefect更新 (b)両プロジェクトのPREFECT_HOME分離、のいずれか)
3. 自動収集の再開判断(スケジューラ・コスト削減とも準備完了)
4. ローカルLLM(自宅GPU RTX 5070 Ti)の精度検証: DBの正解付きイベント約30件で Haiku と比較(費用ゼロで実施)
- 方針: AIの費用見積もりは信用しない。実測ログと Anthropic Console の月額上限で管理する

## 現在のタスク

- [ ] フェーズ2-A 着手準備(スクレイピング基盤の設計・実装)
- [x] minstrel.live ドメインの DNS 接続(公開済み)
- [ ] ヘッダー「コンサート一覧」リンクを `href="#"` → `href="/"` に変更
- [ ] 管理画面: イベント画像の手動アップロード UI 追加(スクショ貼り付け / ファイル選択)。外部サイトが Vercel からの fetch を拒否すると「URLから取得」「画像URL」が両方失敗するため、手動の入り口を用意する(2026-08-18 掲載依頼対応で発覚)
- [ ] 「再リサーチ」「説明文生成」のコスト削減検討(Sonnet + Web検索×最大8ループが高コスト。Haiku 化 or ループ上限縮小)
- [ ] 管理画面: 都道府県の編集フィールド追加(現状UIから修正不可。収集データの県欠損は今後も発生見込み。当面は python/scripts/fix_prefecture_inishie.py 方式で個別対応)(2026-08-18)
- [ ] 収集パイプライン: イベント名が自動で入らないケースの改善(クロール時にできるだけイベント名を抽出・設定する。抽出失敗時のフォールバックも検討)(2026-08-18)
- [ ] 収集パイプライン: 公式サイトURL・X リンクの自動取得(teket の「主催者団体情報」欄に公式サイト・X のリンクが載っていることが多いので、そこから抽出するロジックを追加。現状は毎回手入力で探しており負担大)(2026-08-18)
- [ ] 【今後の改善案】チケット販売開始日時の取得を廃止し、開催日程のみ取得する形にする(先行・一般など販売形態が複雑でうまく拾えないことが多い。販売開始日時は各自で確認・購入してもらう。公開時の必須項目からも外す。X検索での発売日取得など関連処理の停止はAPIコスト削減にもつながる)(2026-09-28)
- [ ] 【今後の改善案】掲載依頼への対応でコンサートを登録したとき、依頼者へ「登録しました」メールを自動返信する仕組み(2026-09-28)
- [ ] 【今後の改善案】Xへの自動投稿の拡充: (1)サイトにコンサートが登録されたタイミングで「こんなコンサートが追加されました」と自動ポスト (2)月1回程度「今月のコンサート」まとめポスト(週1回など定期発信も含めて検討)。既存のX予約投稿システム(月・金投稿フロー)の拡張として検討する(2026-09-28)

## 関連 Issue

### 未解決事項(decision/pending)

| Issue | 旧 P-NN | 内容 | 緊急度 |
|---|---|---|---|
| #4 | P-001 | Badge.tsx chamber カラーリファクタリング | 低 |
| #5 | P-002 | 管理画面実装時の authenticated 用 RLS ポリシー | 中 |
| #6 | P-003 | アフィリエイト導入時の Vercel プラン見直し | 中 |
| #7 | P-004 | B-roll 自動取得パイプラインの統合方針 | 中 |
| #8 | P-005 | スクレイピング User-Agent「ConcertInfoBot」の正式化 | 低 |
| #9 | P-006 | Substack 展開の具体的な連携方針 | 低 |
| #10 | P-007 | 認証機能(お気に入り・マイカレンダー)の実装要否 | 不明 |
| #11 | P-008 | venue の DB 正規化レベル | 低 |

### 採用済み決定(decision/adopted、参照用)

| Issue | 旧 D-NN | 内容 |
|---|---|---|
| #12 | D-020 | 画像取得の3段階フォールバック優先順位 |
| #13 | D-021 | カードレイアウト「羊皮紙カード型グリッド」 |
| #14 | D-022 | ダークモード対応をフェーズ1では実装しない |
| #15 | D-023 | globals.css の CSS リセットを @layer base でラップ |
| #16 | D-024 | memory_bank システムの導入 |
| #17 | D-025 | memory_bank プロトコルを AI News Pipeline から移植 |
| #18 | D-026 | AUTO-PUSH POLICY の有効化 |
| #19 | D-027 | Claude.ai 専用セッション開始ハブの導入 |
| #20 | D-028 | memory_bank 整合性修正 |

## 次のアクション

フェーズ2(情報収集パイプライン)の設計議論に着手するか、
DNS 接続・ヘッダーリンク修正などの軽微なタスクから処理するかを判断する。

## 旧メモリーバンクからの引き継ぎ

旧 docs/archive/memory_bank/ システム(D-001〜D-028)は参照のみ・更新停止。
P-001〜P-008 → GitHub Issues #4〜#11 として移行済み(G1-2 完了)。
D-020〜D-028 → GitHub Issues #12〜#20 として移行済み(G2-1 完了)。
D-001〜D-019 は設計書・コードに内容が埋め込まれているため Issue 化不要と判断。

## 補足: 開発サーバーの起動方法

cd C:\Users\katar\repos\active\minstrel\web
npm run dev

ブラウザで http://localhost:3001 を開く(3000 ではない)。
