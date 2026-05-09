"""
イベント名を日本語→英語に一括翻訳し、events.event_name_en に保存する。

実行方法（python/ ディレクトリから）:
  python scripts/translate_event_names.py

動作:
  - event_name_en が未設定のイベントのみ処理（再実行安全）
  - Claude Haiku でバッチ翻訳（20件ずつ）
  - 翻訳失敗した場合はスキップして継続
"""
import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import anthropic
from utils.config import ANTHROPIC_API_KEY
from utils.db import get_client

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
db = get_client()

BATCH_SIZE = 20

SYSTEM = """You are a translator specializing in Japanese game music concert titles.
Translate each Japanese concert name to natural English.
Rules:
- Keep game series names in their official English form (e.g. ファイナルファンタジー → Final Fantasy, ゼルダの伝説 → The Legend of Zelda)
- Keep proper nouns like orchestra/ensemble names as-is or transliterate
- Keep volume/episode numbers (Vol., #, etc.)
- Return ONLY a JSON array: [{"id": "...", "en": "..."}, ...]
- No explanations, no markdown fences, just the JSON array"""


def translate_batch(batch: list[dict]) -> dict[str, str]:
    """バッチ翻訳。戻り値: {event_id: translated_name}"""
    items = [{"id": row["id"], "ja": row["event_name"]} for row in batch]
    prompt = f"Translate these concert names:\n{json.dumps(items, ensure_ascii=False, indent=2)}"

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    start, end = text.find("["), text.rfind("]") + 1
    if start == -1:
        return {}
    try:
        results = json.loads(text[start:end])
        return {r["id"]: r["en"] for r in results if "id" in r and "en" in r}
    except (json.JSONDecodeError, KeyError):
        return {}


def run() -> None:
    result = db.table("events").select("id, event_name").is_("event_name_en", "null").order("start_datetime").execute()
    pending = result.data or []

    if not pending:
        print("すべてのイベントに英語タイトルが設定済みです。")
        return

    print(f"翻訳対象: {len(pending)} 件\n")
    batches = [pending[i:i + BATCH_SIZE] for i in range(0, len(pending), BATCH_SIZE)]

    success = 0
    failed = 0

    for i, batch in enumerate(batches, 1):
        print(f"[{i:2d}/{len(batches)}] {batch[0]['event_name'][:30]}… ({len(batch)} 件)")
        translations = translate_batch(batch)
        time.sleep(0.5)

        for row in batch:
            en = translations.get(row["id"])
            if en:
                db.table("events").update({"event_name_en": en}).eq("id", row["id"]).execute()
                success += 1
            else:
                print(f"  ※ 翻訳失敗: {row['event_name']}")
                failed += 1

    print(f"\n完了: 成功 {success} 件 / 失敗 {failed} 件")


if __name__ == "__main__":
    run()
