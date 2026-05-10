"""
game_titles テーブルのエイリアスレコードを正式名称に統合する。
一度だけ実行する使い捨てスクリプト。
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.config import SUPABASE_URL, SUPABASE_SECRET_KEY
from supabase import create_client

ALIASES = {
    "ポケモン": "ポケットモンスター",
}


def migrate(db):
    for alias, canonical in ALIASES.items():
        alias_rec = db.table("game_titles").select("id").eq("title_name", alias).execute()
        if not alias_rec.data:
            print(f"[skip] '{alias}' は存在しない")
            continue
        alias_id = alias_rec.data[0]["id"]

        canonical_rec = db.table("game_titles").select("id").eq("title_name", canonical).execute()
        if canonical_rec.data:
            canonical_id = canonical_rec.data[0]["id"]
            print(f"[found] '{canonical}' id={canonical_id}")
        else:
            created = db.table("game_titles").insert({"title_name": canonical}).execute()
            canonical_id = created.data[0]["id"]
            print(f"[created] '{canonical}' id={canonical_id}")

        links = db.table("event_game_titles").select("event_id").eq("game_title_id", alias_id).execute()
        moved = 0
        skipped = 0
        for row in links.data:
            eid = row["event_id"]
            exists = (
                db.table("event_game_titles")
                .select("event_id")
                .eq("event_id", eid)
                .eq("game_title_id", canonical_id)
                .execute()
            )
            if exists.data:
                db.table("event_game_titles").delete().eq("event_id", eid).eq("game_title_id", alias_id).execute()
                skipped += 1
            else:
                (
                    db.table("event_game_titles")
                    .update({"game_title_id": canonical_id})
                    .eq("event_id", eid)
                    .eq("game_title_id", alias_id)
                    .execute()
                )
                moved += 1

        db.table("game_titles").delete().eq("id", alias_id).execute()
        print(f"[done] '{alias}' -> '{canonical}': moved={moved}, skipped(dup)={skipped}, alias record deleted")


if __name__ == "__main__":
    db = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    migrate(db)
