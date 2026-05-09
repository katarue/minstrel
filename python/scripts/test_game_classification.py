"""
ゲームタイトル分類精度テスト

EXTRACTION_SYSTEM プロンプトが、ゲーム原作タイトルとアニメ・漫画原作タイトルを
正しく分類できるかを測定する。

実行方法（python/ ディレクトリから）:
  python scripts/test_game_classification.py
"""
import sys
import os
import json
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import anthropic
from processor.claude_extractor import EXTRACTION_SYSTEM, EXTRACTION_SCHEMA
from utils.config import ANTHROPIC_API_KEY

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# =============================================================================
# テストデータ
# True  = ゲーム原作（game_titles に含まれるべき）
# False = アニメ・漫画・小説原作（game_titles に含まれないべき）
# =============================================================================

GAME_TITLES: list[str] = [
    "ファイナルファンタジー",
    "ゼルダの伝説",
    "ポケモン",
    "ドラゴンクエスト",
    "モンスターハンター",
    "スーパーマリオ",
    "バイオハザード",
    "メタルギアソリッド",
    "ダークソウル",
    "ニーア：オートマタ",
    "ストリートファイター",
    "ソニック・ザ・ヘッジホッグ",
    "ロックマン",
    "星のカービィ",
    "スプラトゥーン",
    "どうぶつの森",
    "クロノ・トリガー",
    "キングダムハーツ",
    "ペルソナ",
    "ACE COMBAT",
    "太鼓の達人",
    "戦場のヴァルキュリア",
    "ファイアーエムブレム",
    "MOTHER",
    "ドラゴンズドグマ",
    "UNDERTALE",
    "テイルズ オブ シリーズ",
    "グランブルーファンタジー",
    "原神",
    "アークナイツ",
    "プロジェクトセカイ",
    "ブルーアーカイブ",
    "崩壊スターレイル",
    "サクラ大戦",
    "ゼノギアス",
    "ICO",
    "エルデンリング",
    "Minecraft",
    "グランツーリスモ",
    "大神",
    "beatmania IIDX",
    "maimai",
    "ウマ娘 プリティーダービー",
    "ゼノブレイド",
    "ブレイブリーデフォルト",
    "プリンセスコネクト！Re:Dive",
    "ファイナルファンタジーXIV",
    "APEX LEGENDS",
    "オーバーウォッチ",
    "風ノ旅ビト",
]

# ※ ラブライブ！・アイドルマスター・バンドリ！は技術的起源が議論されるが
#   システムプロンプトで明示的に「除外」と定義されているためここで除外扱いとする
NON_GAME_TITLES: list[str] = [
    "鬼滅の刃",
    "進撃の巨人",
    "ワンピース",
    "ナルト",
    "ドラゴンボール",
    "機動戦士ガンダム",
    "新世紀エヴァンゲリオン",
    "呪術廻戦",
    "僕のヒーローアカデミア",
    "ソードアート・オンライン",
    "ハンター×ハンター",
    "鋼の錬金術師",
    "BLEACH",
    "DEATH NOTE",
    "SPY×FAMILY",
    "チェンソーマン",
    "ぼっち・ざ・ろっく！",
    "けいおん！",
    "まどか☆マギカ",
    "コードギアス",
    "マクロス",
    "涼宮ハルヒの憂鬱",
    "五等分の花嫁",
    "かぐや様は告らせたい",
    "葬送のフリーレン",
    "推しの子",
    "薬屋のひとりごと",
    "Re:ゼロから始める異世界生活",
    "転生したらスライムだった件",
    "ハイキュー！！",
    "SLAM DUNK",
    "ルパン三世",
    "宇宙戦艦ヤマト",
    "四月は君の嘘",
    "東京リベンジャーズ",
    "銀魂",
    "犬夜叉",
    "TIGER & BUNNY",
    "鉄腕アトム",
    "カードキャプターさくら",
    "ドラえもん",
    "千と千尋の神隠し",
    "君の名は。",
    "天気の子",
    "聲の形",
    "黒子のバスケ",
    "このすばらしい世界に祝福を！",
    "ラブライブ！",          # プロンプトの除外例に明示
    "アイドルマスター",      # プロンプトの除外例に明示
    "バンドリ！（BanG Dream!）",  # ハイブリッド起源
]

BATCH_SIZE = 10


def normalize(s: str) -> str:
    """タイトルを正規化（小文字化・記号・スペース除去）"""
    s = s.lower()
    s = re.sub(r"[\s　・：:!！?？。、「」【】（）()『』〜～\-_＿]", "", s)
    return s


def is_matched(expected: str, got_titles: list[str]) -> bool:
    """期待タイトルが got_titles のいずれかと部分一致するか"""
    exp_norm = normalize(expected)
    for got in got_titles:
        got_norm = normalize(got)
        if exp_norm in got_norm or got_norm in exp_norm:
            return True
    return False


def classify_batch(batch: list[tuple[str, bool]]) -> dict[str, bool]:
    """
    バッチ内タイトルを架空コンサートテキストに埋め込み、
    game_titles に入ったタイトルを取得する。
    戻り値: {title: is_classified_as_game}
    """
    titles = [t for t, _ in batch]
    titles_str = "・".join(titles)

    text = (
        f"コンサートタイトル：様々な音楽の祭典\n"
        f"演奏楽曲：{titles_str} の楽曲を演奏します。\n"
        f"日時：2026年9月15日（月・祝）19:00開演\n"
        f"会場：東京国際フォーラム ホールA\n"
        f"主催：テスト交響楽団\n"
        f"チケット：一般 5,000円"
    )

    schema_str = json.dumps(EXTRACTION_SCHEMA, ensure_ascii=False, indent=2)
    prompt = (
        f"以下のコンサート情報を解析してください：\n\n{text}\n\n"
        f"以下のJSONスキーマで返してください：\n{schema_str}"
    )

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
        system=EXTRACTION_SYSTEM,
    )

    content = response.content[0].text
    start = content.find("{")
    end = content.rfind("}") + 1
    got_games: list[str] = []
    if start != -1:
        try:
            data = json.loads(content[start:end])
            got_games = data.get("game_titles") or []
        except json.JSONDecodeError:
            pass

    return {title: is_matched(title, got_games) for title, _ in batch}


def run() -> None:
    # ゲームとアニメを交互に並べてバッチ内の偏りを減らす
    interleaved: list[tuple[str, bool]] = []
    for game, anime in zip(GAME_TITLES, NON_GAME_TITLES):
        interleaved.append((game, True))
        interleaved.append((anime, False))

    batches = [interleaved[i:i + BATCH_SIZE] for i in range(0, len(interleaved), BATCH_SIZE)]

    print(f"テスト開始: ゲーム {len(GAME_TITLES)} 件 + 非ゲーム {len(NON_GAME_TITLES)} 件 = {len(interleaved)} 件")
    print(f"バッチ数: {len(batches)} × {BATCH_SIZE} 件\n")

    results: dict[str, tuple[bool, bool]] = {}  # {title: (expected, classified_as_game)}

    for i, batch in enumerate(batches):
        preview = "、".join(t for t, _ in batch[:3]) + "…"
        print(f"[{i + 1:2d}/{len(batches)}] {preview}")
        classified = classify_batch(batch)
        for title, expected in batch:
            results[title] = (expected, classified[title])

    # ========== 集計 ==========
    tp = sum(1 for _, (exp, got) in results.items() if exp and got)
    fp = sum(1 for _, (exp, got) in results.items() if not exp and got)
    tn = sum(1 for _, (exp, got) in results.items() if not exp and not got)
    fn = sum(1 for _, (exp, got) in results.items() if exp and not got)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    accuracy  = (tp + tn) / len(results)

    print("\n" + "=" * 50)
    print("  結果サマリー")
    print("=" * 50)
    print(f"  Accuracy:  {accuracy:.1%}  ({tp + tn}/{len(results)} 正解)")
    print(f"  Precision: {precision:.1%}  (ゲームと判定したうち正解)")
    print(f"  Recall:    {recall:.1%}  (全ゲームタイトルを拾えた割合)")
    print(f"  F1 Score:  {f1:.1%}")
    print(f"\n  TP={tp}  FP={fp}  TN={tn}  FN={fn}")
    print("=" * 50)

    fps = [t for t, (exp, got) in results.items() if not exp and got]
    fns = [t for t, (exp, got) in results.items() if exp and not got]

    if fps:
        print(f"\n[FP] ゲームと誤判定（除外すべきだった）: {len(fps)} 件")
        for t in fps:
            print(f"  - {t}")
    else:
        print("\n[FP] 誤判定なし")

    if fns:
        print(f"\n[FN] ゲームを見逃し（含めるべきだった）: {len(fns)} 件")
        for t in fns:
            print(f"  - {t}")
    else:
        print("\n[FN] 見逃しなし")


if __name__ == "__main__":
    run()
