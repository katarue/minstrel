"""いにしえのひびき の prefecture 欠損を東京都で補完する一回限りの修正スクリプト

実行: cd python && .venv\Scripts\python scripts\fix_prefecture_inishie.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

from utils.db import get_client


def main() -> None:
    sb = get_client()
    res = (
        sb.table("events")
        .select("id, event_name, venue_name, prefecture")
        .like("event_name", "%いにしえのひびき%")
        .execute()
    )
    rows = res.data or []
    if not rows:
        print("対象イベントが見つかりませんでした")
        return
    for row in rows:
        print(f"対象: {row['event_name']} / 会場: {row['venue_name']} / 都道府県: {row['prefecture']}")
        if row["prefecture"]:
            print("  -> 既に都道府県が入っているためスキップ")
            continue
        sb.table("events").update({"prefecture": "東京都"}).eq("id", row["id"]).execute()
        print("  -> 東京都 に更新しました")


if __name__ == "__main__":
    main()
