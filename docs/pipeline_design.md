# パイプライン設計書

Minstrel の情報収集〜公開までのパイプライン全体の設計を記述する。  
「なぜこの設計か」という判断根拠を残すことが目的。実装の詳細はコードを参照。

---

## 設計哲学

**「人間が見なくても事故らない仕組み」**

完全自動化の目標は「全部自動公開する」ではなく、間違った情報を絶対に公開しないこと。
取りこぼしより誤情報のほうが致命的（サイト全体の信頼性に直結する）。

---

## 情報源ランク制

情報源の信頼性をランクで管理し、自動公開の可否を決める。

| ランク | 対象 | 自動公開 | 根拠 |
|---|---|---|---|
| **A** | teket・e+・チケットぴあ | ○ | 運営側が責任を持つ公式販売情報 |
| **B** | peatix・ローソン・livepocket・2083web | ○ | 商業プラットフォームまたは信頼性の高い専門まとめ |
| **C** | X 検索（一般ユーザー投稿） | ✕ | 誤情報・噂・感想ツイートが混入する |

**X 公式アカウントが rank C である理由**：X API 経由で取得するツイートはアカウントの真正性を保証できず、
一般検索では運営公式ツイートと一般ユーザー投稿を区別できない。
モニタリング対象アカウントのツイートも、現時点では C として扱い手動確認キューに入れる。

---

## パイプライン全体フロー

```
[収集]                   [抽出・検証]              [DB 保存]              [公開]
  │
  ├─ flow_collect.py ──→ Claude Haiku抽出 ──→ 機械検証 ──→ 重複検知 ──→ upsert
  │   ├─ teket (A)          ↑スコアリング          ↑ルールベース      ↑ハードキー
  │   ├─ e+ (A)             X ツイートのみ         信頼度スコア計算   チケットURL
  │   ├─ ぴあ (A)                                  auto_publish判定   名前+日付fuzzy
  │   ├─ peatix (B)
  │   ├─ lawson (B)                                                    is_published
  │   ├─ livepocket (B)                                                ├─ true  → 自動公開
  │   └─ x_search (C) ──→ スコア≥70 のみ通過                          └─ false → 手動確認
  │
  ├─ flow_collect_broadcasts.py ──→ broadcasts テーブル
  │   ├─ bangumi (B): TV番組表
  │   └─ X放送局アカウント (C): Claude Haiku抽出
  │
  ├─ flow_collect_organizer_x.py（月次）
  │   └─ オーガナイザーのX プロフィール更新
  │
  └─ flow_post_weekly.py（月・金）
      └─ 公開済みイベントをX に自動投稿
```

---

## AI 処理の役割と限界

### 現在使用している箇所

| 関数 | モデル | 目的 |
|---|---|---|
| `score_announcement()` | claude-haiku | X ツイートが公演告知かどうかを 0-100 でスコアリング |
| `extract_event()` | claude-haiku | HTML・テキストから構造化データを抽出 |
| `scraper_broadcasts.py` | claude-haiku | 放送局ツイートから番組情報を抽出 |

### AI に任せている理由と限界

**任せてよい処理**：
- 自由記述のテキストから JSON への変換（人間が書いたフォーマットはバラバラ）
- X ツイートの告知判定（「終演しました」「行ってきた」等の文脈を理解する必要がある）

**任せてはいけない処理**：
- ファクトチェック（同じモデルが同じ誤情報を繰り返す。「ダブルチェック」は独立した検証にならない）
- 重複判定（ルールベースのほうが確実。AI は「たぶん同じ」と答えてしまう）

**チケットサイト（rank A/B）に AI が必要な理由**：
チケットサイトは HTML 構造がサイトごとに異なり、かつ定期的に変わる。
structured parsing でカバーできるサイトが増えれば AI 依存を減らせる（改善方針参照）。

---

## 重複検知の設計

### 3段階の検知

```
1. source_url の UNIQUE 制約（最速）
   → 同じ URL からの再収集をブロック

2. ハードキー照合（確実）
   → event_external_ids テーブルで ticket_url を UNIQUE 管理
   → 同じチケット販売ページがある = 同じ公演

3. 名前+日付 fuzzy マッチ（フォールバック）
   → 同日に同一タイトルのイベントが存在する場合はマージ候補
   → 完全一致のみ（80%類似などは採用していない）
```

### 現在の課題

- **タイトル表記ゆれ**: 「〇〇 コンサート」と「〇〇コンサート」が別扱いになる
- **オーガナイザーが重複検知に使われていない**: 同日同タイトルでも開催者が違えば別公演なのに、フォールバックが誤マージする可能性がある
- **ツアー公演の重複**: 同ツアーの東京/大阪公演を誤って同一公演とみなすリスク

---

## 自動公開の判定ロジック（現状）

`auto_publish_eligible = true` になる条件（validator/machine_validator.py）：

1. `source_rank` が A または B
2. 検証エラーなし（必須フィールド欠損・過去日時等）
3. キャンセルでない
4. 最低情報あり（start_datetime・会場またはオンライン・description・organizer_name・game_titles）

`auto_publish_eligible = true` → `is_published = true`（自動公開）

### X ソースが自動公開できない理由

現在すべての X ソースは `source_rank = C`。validator は rank A/B のみ eligible にするため、
X 由来のイベントはスコアリング・抽出を通過してもキューに積まれる（`match_status = review_needed`）。
これは意図的な設計であり、サイトの信頼性を守るための制約。

---

## 改善方針

以下は合意済みの改善方向。実装順は未確定。

### 1. trust_tier の導入（オーガナイザー信頼度管理）

**課題**：ゲーム音楽専門のオーガナイザー（例: スクウェア・エニックス公式、専門オケ）と
一般オーガナイザーを区別できていない。前者の公式 X アカウントは信頼性が高いが、現状は rank C 扱い。

**方針**：
- `organizers` テーブルに `trust_tier` カラム追加（例: `exclusive` / `partial` / `unknown`）
- `exclusive`: ゲーム音楽専門 → 公式 X アカウントのツイートを rank A 相当として扱う候補
- `partial`: たまにゲーム音楽をやる → 現状維持（rank C）
- tier の管理は X のリスト機能を活用（X リスト → DB sync で管理）

**効果**：ReviewQueue の手動作業を専門オーガナイザー分だけ削減できる

### 2. チケットサイトの structured parsing 化

**課題**：rank A サイト（teket・e+・ぴあ）でも Claude Haiku を呼んでいる。
これらは HTML 構造が比較的安定しており、AI なしで解析できる可能性がある。

**方針**：
- 各スクレイパーでフィールドを直接マッピング（例: teket は JSON API のため最も容易）
- AI は「構造化できなかった場合のフォールバック」に格下げ
- コスト削減・速度向上・エラーパターンの単純化

**優先順位**：teket（JSON API、最容易）→ e+（HTML 安定）→ ぴあ（Playwright 必要）

### 3. X フローの分離

**課題**：`flow_collect.py` が rank A〜C を混在処理しているため、
チケットサイト処理と X 処理の挙動が混ざって複雑。

**方針**：
- `flow_collect_tickets.py`（rank A/B 専用、高頻度実行）
- `flow_collect_x.py`（rank C 専用、低頻度・trust_tier 対応）

**効果**：ticket flow は安定稼働させつつ X flow だけ設定変更・停止が可能になる

### 4. 重複検知の改善

**課題**：名前+日付のフォールバックマッチにオーガナイザー情報が使われていない。

**方針**：
- fuzzy match の条件に `organizer_id` を追加（同オーガナイザーかどうかを確認）
- タイトル正規化の強化（全角/半角統一・スペース除去・括弧内除去）

---

## 現在のスケジュール（Prefect）

| フロー | 頻度 | 用途 |
|---|---|---|
| `flow_collect` | 日次（毎朝） | メインイベント収集 |
| `flow_collect_broadcasts` | 日次（fetch_x_broadcasts）/ 週次（fetch_bangumi） | 放送情報収集 |
| `flow_collect_organizer_x` | 月次（毎月1日） | オーガナイザープロフィール更新 |
| `flow_post_weekly` | 月曜・金曜 | X 自動投稿 |

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `python/flows/flow_collect.py` | メイン収集フロー |
| `python/processor/claude_extractor.py` | AI 抽出・スコアリング |
| `python/validator/machine_validator.py` | ルールベース検証・auto_publish 判定 |
| `python/utils/entity_resolution.py` | 重複検知・マージ |
| `python/scrapers/` | 各情報源のスクレイパー |
