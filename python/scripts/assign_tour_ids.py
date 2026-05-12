"""
同一オーガナイザー・同一タイトル（括弧内地名を除去して比較）の
イベントを自動検出し、tour_id を一括アサインする。

実行方法（python/ ディレクトリから）:
  python scripts/assign_tour_ids.py

動作:
  - tour_id が未設定のイベントのみ対象（再実行安全）
  - 同一オーガナイザー + 正規化タイトルが一致するグループに共通 UUID を付与
  - 1公演のみのイベントは tour_id を設定しない
"""
import sys
import os
import re
import uuid
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from utils.config import SUPABASE_URL, SUPABASE_SECRET_KEY
from supabase import create_client

db = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)


def normalize_title(name: str) -> str:
    """末尾の（地名）・【地名】・(City)・〇〇公演 を除去して正規化する。"""
    name = re.sub(r'[\s　]*[（(][^）)]*[）)]\s*$', '', name).strip()
    name = re.sub(r'[\s　]*【[^】]*】\s*$', '', name).strip()
    # 「横浜公演」「東京公演」など、括弧なし地名+公演 suffix を除去
    name = re.sub(r'[\s　]+\S+公演\s*$', '', name).strip()
    return name


def run() -> None:
    r = db.table("events").select(
        "id, event_name, start_datetime, organizer_id, tour_id"
    ).eq("is_published", True).is_("tour_id", "null").order("event_name").execute()
    events = r.data or []

    if not events:
        print("tour_id 未設定のイベントはありません。")
        return

    # organizer_id + 正規化タイトル でグループ化
    groups: dict[tuple, list] = defaultdict(list)
    for ev in events:
        key = (ev["organizer_id"], normalize_title(ev["event_name"]))
        groups[key].append(ev)

    tour_groups = {k: v for k, v in groups.items() if len(v) > 1}
    print(f"ツアー候補: {len(tour_groups)} グループ\n")

    assigned = 0
    for (org_id, title), evs in tour_groups.items():
        tour_id = str(uuid.uuid4())
        ids = [ev["id"] for ev in evs]
        print(f"  [{title}] {len(evs)}公演 → tour_id={tour_id}")
        for ev in sorted(evs, key=lambda x: x["start_datetime"]):
            print(f"    {ev['start_datetime'][:10]}  {ev['event_name']}")
        db.table("events").update({"tour_id": tour_id}).in_("id", ids).execute()
        assigned += len(ids)
        print()

    print(f"完了: {assigned} 件に tour_id を設定しました。")


if __name__ == "__main__":
    run()
