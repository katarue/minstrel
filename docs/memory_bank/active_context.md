# Active Context

このファイルはMinstrelプロジェクトの「現在地」を示す。新規セッション開始時に必ず最初に読むこと。

**最終更新**: 2026年5月7日

---

## プロジェクト現在地

### フェーズ
**フェーズ1（基盤構築）完了。メモリーバンク移植完了。次はフェーズ2（情報収集パイプライン）。**

### 完了したセクション
- ✓ フェーズ0：準備（アカウント・APIキー取得）
- ✓ フェーズ1-A：DB構築（スキーマ作成・テーブル作成・RLS設定・テストデータ投入）
- ✓ フェーズ1-B：Next.js基盤（プロジェクト初期化・Tailwind・Supabase接続・デザイントーン・共通コンポーネント）
- ✓ フェーズ1-C：基本ページ実装（トップページ・イベント詳細・演奏団体・ゲームタイトル）
- ✓ フェーズ1-D：仮公開（Vercelデプロイ済み）
- ✓ メモリーバンク・プロトコル移植（D-025）
- ✓ AUTO-PUSH POLICY 有効化（D-026）

### 残タスク
- フェーズ2：情報収集パイプライン構築（Prefect + Python スクレイピング）
- minstrel.live ドメイン DNS 接続
- ヘッダー「コンサート一覧」リンクを `/` に接続（現在 `#`）
- カレンダーページ（フェーズ3以降）

---

## 次の3ステップ

### ステップ1：minstrel.live ドメイン接続

Vercel プロジェクト設定 → Domains → `minstrel.live` を追加。
DNS レコードをドメイン管理会社に設定する（Vercel が A レコードまたは CNAME を指示）。

### ステップ2：フェーズ2 設計

情報収集パイプラインの設計着手。`docs/implementation_schedule.md` のフェーズ2タスクを確認する。

### ステップ3：ヘッダーナビの整理

「コンサート一覧」を `href="#"` から `href="/"` に変更（トップページはコンサート一覧）。
「カレンダー」は将来実装まで `href="#"` のままでよい。

---

## 現在のリポジトリ状態

- **mainブランチ**: 最新（フェーズ1完了、push済み）
- **デプロイ先**: Vercel（本番公開済み）
- **Supabase**: `https://pobbxakrszuldyhyjrjp.supabase.co`
- **開発サーバーポート**: 3001

### 直近のコミット

```
794e788 Merge pull request #1 from katarue/chore/memory-bank-port
096889c chore: メモリーバンク・プロトコルを AI News Pipeline から移植 (D-025)
07a1736 chore: Vercelデプロイ設定追加 (1-D-1)
1dd6a5f feat: ゲームタイトル一覧・詳細ページ実装 (1-C-4) をmainにマージ
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
- `NEXT_PUBLIC_SUPABASE_URL`: `https://pobbxakrszuldyhyjrjp.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### メモリーバンク運用

- セッション開始時: `session_log.md` に OPEN タイムスタンプ記録 → memory_bank/ 6ファイルを順番に読む
- セッション終了時: 「クロージングを始めて」で CLOSING RITUAL（3 Gate）を起動
- 詳細: `docs/memory_bank/framework_overview.md` を参照

### CSS の重要ルール（D-023）

`globals.css` の CSS リセットは必ず `@layer base { }` で囲む。
unlayered CSS は Tailwind ユーティリティに勝ってしまい px-* 等が無効化される。

### ブランチ運用

- 作業は必ず `feature/*` または `chore/*` ブランチで行う
- main への直接コミット禁止
- `.githooks/` 有効化済み（`git config core.hooksPath .githooks`、D-026）
- `feature/*` ブランチのコミット時に自動 push

---

## フェーズ1で発覚した主要な罠（次回以降も有効）

1. **Supabase publishable/secret key 新方式**（D-018）
2. **GRANT権限の自動付与なし**（D-019）
3. **CSSの@layer問題**（D-023）
4. **ポート競合: 3001 固定**（D-010）
5. **game_titles に genre カラムなし**（series_name / publisher で代替）
6. **event_game_titles ネスト取得の TypeScript 型推論**（配列型になる、flatMap で対処）
