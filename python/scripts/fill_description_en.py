"""
description_en が未設定のイベントを Claude API で一括翻訳する。
実行: python scripts/fill_description_en.py
"""

import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv
from utils.db import get_client
from processor.claude_extractor import translate_event_descriptions_en

load_dotenv()

BATCH_SIZE = 10


def main():
    db = get_client()

    rows = (
        db.table("events")
        .select("id, description")
        .not_.is_("description", "null")
        .is_("description_en", "null")
        .execute()
        .data
    )

    print(f"対象レコード: {len(rows)} 件")
    if not rows:
        return

    updated = 0
    errors = 0

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        descs = [r["description"] for r in batch]
        print(f"  [{i + 1}〜{i + len(batch)}] 翻訳中...")

        translated = translate_event_descriptions_en(descs)

        for row, en_desc in zip(batch, translated):
            if en_desc:
                db.table("events").update({"description_en": en_desc}).eq("id", row["id"]).execute()
                print(f"    ✓ {row['description'][:40]}")
                updated += 1
            else:
                print(f"    [SKIP] {row['description'][:40]}")
                errors += 1

        if i + BATCH_SIZE < len(rows):
            time.sleep(1)

    print(f"\n完了: 更新 {updated} 件 / スキップ {errors} 件")


if __name__ == "__main__":
    main()
