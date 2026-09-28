"""
DB内の重複イベントを検出するスクリプト。

検出基準:
  - 同じ日付（start_datetime の日付部分が一致）
  - タイトル類似度 80% 以上（difflib.SequenceMatcher）

出力:
  - 重複候補ペアの一覧（コンソール）
  - 削除候補の event ID リスト（末尾）
"""

import sys
import os
from difflib import SequenceMatcher

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.config import SUPABASE_URL, SUPABASE_SECRET_KEY
from supabase import create_client

SIMILARITY_THRESHOLD = 0.80


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def main():
    db = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

    result = db.table("events").select(
        "id, event_name, start_datetime, venue_name, prefecture, "
        "organizer_id, confidence_score, is_published, source_rank"
    ).order("start_datetime").execute()

    events = result.data or []
    print(f"総イベント数: {len(events)} 件\n")

    # 日付ごとにグループ化
    by_date: dict[str, list[dict]] = {}
    for ev in events:
        dt = (ev.get("start_datetime") or "")[:10]
        if not dt:
            continue
        by_date.setdefault(dt, []).append(ev)

    # 各日付グループ内でペアを総当たり比較
    suspicious_pairs: list[tuple[dict, dict, float]] = []
    for date, group in by_date.items():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                a, b = group[i], group[j]
                name_a = a.get("event_name") or ""
                name_b = b.get("event_name") or ""
                score = similarity(name_a, name_b)
                if score >= SIMILARITY_THRESHOLD:
                    suspicious_pairs.append((a, b, score))

    if not suspicious_pairs:
        print("重複候補なし。")
        return

    print(f"重複候補: {len(suspicious_pairs)} ペア\n")
    print("=" * 70)

    delete_candidates: list[str] = []

    for a, b, score in sorted(suspicious_pairs, key=lambda x: -x[2]):
        date = (a.get("start_datetime") or "")[:10]
        print(f"類似度: {score:.0%}  日付: {date}")
        print(f"  A) [{a['id']}]  {a['event_name']}")
        print(f"     prefecture={a.get('prefecture')}  venue={a.get('venue_name')}")
        print(f"     rank={a.get('source_rank')}  confidence={a.get('confidence_score')}  published={a.get('is_published')}")
        print(f"  B) [{b['id']}]  {b['event_name']}")
        print(f"     prefecture={b.get('prefecture')}  venue={b.get('venue_name')}")
        print(f"     rank={b.get('source_rank')}  confidence={b.get('confidence_score')}  published={b.get('is_published')}")

        # 削除候補の自動判定（より低品質な方を提案）
        # 優先度: source_rank A > B > C、次に confidence_score 高い方、次に published
        def rank_score(ev: dict) -> tuple:
            rank_order = {"A": 2, "B": 1, "C": 0}
            return (
                rank_order.get(ev.get("source_rank", "C"), 0),
                ev.get("confidence_score") or 0,
                1 if ev.get("is_published") else 0,
            )

        keep, drop = (a, b) if rank_score(a) >= rank_score(b) else (b, a)
        print(f"  → 残す推奨: [{keep['id']}]  削除候補: [{drop['id']}]")
        delete_candidates.append(drop["id"])
        print()

    print("=" * 70)
    print(f"\n削除候補 ID 一覧（{len(delete_candidates)} 件）:")
    for id_ in delete_candidates:
        print(f"  {id_}")

    print("\n※ 実際の削除は手動で確認後、以下を実行してください:")
    print('   db.table("events").delete().eq("id", "<id>").execute()')


if __name__ == "__main__":
    main()
