"""prefecture 欠損イベントを会場名マッピングで補完するスクリプト

実行: cd python && .venv\Scripts\python scripts\fix_missing_prefectures.py

新しい会場で欠損が出たら VENUE_PREFECTURE_MAP に追記して再実行する。
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

from utils.db import get_client

# 会場名の部分一致 → 都道府県
VENUE_PREFECTURE_MAP = {
    "調布市グリーンホール": "東京都",
    "板橋区立文化会館": "東京都",
    "杜のホールはしもと": "神奈川県",  # ほねごり杜のホールはしもと（相模原市緑区）
    "スタジオ ヴィルトゥオージ": "東京都",  # いにしえのひびき（新宿区）
}


def main() -> None:
    sb = get_client()
    res = (
        sb.table("events")
        .select("id, event_name, venue_name, prefecture")
        .is_("prefecture", "null")
        .execute()
    )
    rows = res.data or []
    if not rows:
        print("prefecture 欠損のイベントはありません")
        return

    fixed = 0
    unfixed = []
    for row in rows:
        venue = row.get("venue_name") or ""
        pref = next(
            (p for key, p in VENUE_PREFECTURE_MAP.items() if key in venue), None
        )
        if pref:
            sb.table("events").update({"prefecture": pref}).eq("id", row["id"]).execute()
            print(f"更新: {row['event_name']} / {venue} -> {pref}")
            fixed += 1
        else:
            unfixed.append(row)

    print(f"\n{fixed} 件更新しました")
    if unfixed:
        print("マッピング未登録で残った欠損:")
        for row in unfixed:
            print(f"  - {row['event_name']} / 会場: {row.get('venue_name')}")
        print("VENUE_PREFECTURE_MAP に会場名と都道府県を追記して再実行してください")


if __name__ == "__main__":
    main()
