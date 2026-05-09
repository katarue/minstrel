"""
DBに登録済みのゲームタイトルをすべて取得し、
Claude Haiku にゲーム原作かどうかを審査させる（読み取り専用・DB変更なし）。

実行方法（python/ ディレクトリから）:
  python scripts/audit_game_titles.py

出力:
  - ゲーム原作: 含めてOKなタイトル
  - 非ゲーム原作: 除外すべきタイトル
  - 不明: Haiku が判断できなかったタイトル
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import anthropic
from utils.db import get_client
from utils.config import ANTHROPIC_API_KEY

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
db = get_client()

BATCH_SIZE = 20

AUDIT_SYSTEM = """
あなたはゲームIP（知的財産）の起源を判定する専門家です。
与えられたタイトルリストについて、それぞれ「ゲームが原作（最初にゲームとしてリリースされた）か」を判定してください。

【判定基準】
- ゲーム原作 (true): そのIPが最初にゲームとして世に出たもの
  例: ファイナルファンタジー、ゼルダの伝説、ポケモン、モンスターハンター、プリンセスコネクト
- 非ゲーム原作 (false): 漫画・アニメ・小説・映画が原作で、後からゲーム化されたもの
  例: 鬼滅の刃（漫画）、進撃の巨人（漫画）、ラブライブ！（アニメ）、ソードアート・オンライン（小説）
- 不明 (null): 判断できない場合

以下のJSON配列のみを返してください（説明文不要）：
[
  {"title": "タイトル名", "is_game_origin": true または false または null, "reason": "判定理由（1行）"},
  ...
]
"""


def audit_batch(titles: list[dict]) -> list[dict]:
    """タイトルのバッチを Haiku に審査させる。"""
    title_list = json.dumps([t["title_name"] for t in titles], ensure_ascii=False)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=AUDIT_SYSTEM,
        messages=[{"role": "user", "content": f"以下のタイトルを審査してください：\n{title_list}"}],
    )

    content = response.content[0].text.strip()
    start = content.find("[")
    end = content.rfind("]") + 1
    if start == -1:
        return []
    try:
        return json.loads(content[start:end])
    except json.JSONDecodeError:
        return []


def run() -> None:
    # DB から全タイトル取得
    result = db.table("game_titles").select("id, title_name").order("title_name").execute()
    all_titles = result.data or []

    if not all_titles:
        print("game_titles テーブルにデータがありません。")
        return

    print(f"審査対象: {len(all_titles)} タイトル")
    print(f"バッチ数: {(len(all_titles) + BATCH_SIZE - 1) // BATCH_SIZE} × 最大{BATCH_SIZE}件\n")

    audit_results: list[dict] = []
    batches = [all_titles[i:i + BATCH_SIZE] for i in range(0, len(all_titles), BATCH_SIZE)]

    for i, batch in enumerate(batches):
        preview = "、".join(t["title_name"] for t in batch[:3]) + "…"
        print(f"[{i + 1:2d}/{len(batches)}] {preview}")
        judged = audit_batch(batch)

        # Haiku の結果をタイトル名で DB レコードと紐づける
        judged_map = {j["title"]: j for j in judged}
        for row in batch:
            name = row["title_name"]
            judge = judged_map.get(name, {})
            audit_results.append({
                "id": row["id"],
                "title_name": name,
                "is_game_origin": judge.get("is_game_origin"),
                "reason": judge.get("reason", "（判定結果なし）"),
            })

    # ========== 集計・出力 ==========
    game_ok    = [r for r in audit_results if r["is_game_origin"] is True]
    non_game   = [r for r in audit_results if r["is_game_origin"] is False]
    uncertain  = [r for r in audit_results if r["is_game_origin"] is None]

    print("\n" + "=" * 55)
    print("  審査結果サマリー")
    print("=" * 55)
    print(f"  ゲーム原作（OK）:   {len(game_ok):3d} 件")
    print(f"  非ゲーム原作（要対応）: {len(non_game):3d} 件")
    print(f"  不明:              {len(uncertain):3d} 件")
    print("=" * 55)

    if non_game:
        print(f"\n【非ゲーム原作 — 除外を検討すべきタイトル】")
        for r in non_game:
            print(f"  - {r['title_name']}")
            print(f"      理由: {r['reason']}")

    if uncertain:
        print(f"\n【不明 — 手動確認が必要なタイトル】")
        for r in uncertain:
            print(f"  - {r['title_name']}")
            print(f"      理由: {r['reason']}")

    if not non_game and not uncertain:
        print("\n全タイトルがゲーム原作と判定されました。対応不要です。")

    # 非ゲーム原作タイトルの ID リストを保存（次のステップで使用可能）
    if non_game:
        non_game_ids = [r["id"] for r in non_game]
        print(f"\n非ゲーム原作 ID リスト（削除スクリプト用）:")
        print(non_game_ids)


if __name__ == "__main__":
    run()
