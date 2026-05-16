# Minstrel 運用状況（現行）

**最終更新: 2026-05-17**

このドキュメントは「現在実際にどう動いているか」を記録する。
計画書（implementation_schedule.md）は初期アイデアであり、現状と乖離しているため参照しないこと。

---

## 収集パイプライン概要

情報収集は **2段階** で構成されている。

### ステージ1: チケットサイトスクレーピング

大手チケット販売プラットフォームをキーワード検索でスクレーピングする。

| スクレイパー | 対象サイト |
|---|---|
| `scraper_teket.py` | teket |
| `scraper_pia.py` | チケットぴあ |
| `scraper_lawson.py` | ローソンチケット |
| `scraper_eplus.py` | イープラス |
| `scraper_livepocket.py` | LivePocket |
| `scraper_peatix.py` | Peatix |

### ステージ2: X（旧Twitter）検索

チケットサイトだけでは補足できない公演を収集する。

**補完対象:**
- 中小規模コンサート（チケット販売手数料の関係で大手サイトに掲載しないケース）
- チケット不要の無料公演
- 自前のチケットシステムを持つ大企業主催の公演

| スクレイパー | 内容 |
|---|---|
| `scraper_x_search.py` | キーワード検索（「ゲーム音楽 コンサート」等） |
| `scraper_organizer_x.py` | 主要演奏団体の公式Xアカウントを個別追跡 |

追跡アカウントリスト: `python/data/x_following_handles.json`

### その他スクレイパー（別カテゴリ）

| スクレイパー | 内容 |
|---|---|
| `scraper_bangumi.py` | 番組表.Gガイド（TV・ラジオ放送情報） |
| `scraper_broadcasts.py` | 放送局公式XアカウントからTV放送情報を収集 |

---

## 廃止・非使用スクレイパー

以下のスクレイパーはファイルとして存在するが、**使用しないこと**。

| ファイル | 理由 |
|---|---|
| `scraper_2083web.py` | 2083WEBは情報源として使用しない方針に変更 |
| `scraper_2083web_archive.py` | 同上 |

---

## パイプラインフロー

```
スクレーピング（各scraper）
    ↓
構造化抽出（Claude API）
    ↓
機械検証（ルールベース）
    ↓
画像処理（Supabase Storage保存）
    ↓
DB upsert
    ↓
auto_enrich（不足フィールドをweb検索で補完）
```

Prefect で定期実行。フロー定義: `python/flows/flow_collect.py`

---

## 情報源ランク

- **Aランク**: 公式チケットサイト、公式X → `auto_publish_eligible=true` 対象
- **Bランク**: 補助情報（Xキーワード検索等）→ 手動確認推奨
- **Cランク**: 一般ユーザー投稿 → 発見用のみ、公開ソースにしない
