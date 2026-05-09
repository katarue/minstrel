"""
非ゲーム原作タイトルをDBから除去し、ゲームタイトルが残らなくなったイベントを非表示にする。

実行方法（python/ ディレクトリから）:
  python scripts/cleanup_non_game_titles.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from utils.db import get_client

db = get_client()

# 除外するタイトル名（audit_game_titles.py + ムーチョさん確認済み）
REMOVE_TITLES = [
    "Link! Like! ラブライブ!",
    "ラブライブ！スーパースター！！",
    "ラブライブ！スクールアイドルフェスティバル ALL STARS",
    "少女☆歌劇 レヴュースタァライト",
    "アレルヤ！ラウダムス・テ",
    "ファントム",
]


def run() -> None:
    # 1. 除外対象タイトルの ID を取得
    result = db.table("game_titles").select("id, title_name").in_("title_name", REMOVE_TITLES).execute()
    found = result.data or []

    if not found:
        print("対象タイトルが見つかりませんでした。")
        return

    print(f"除外対象タイトル ({len(found)} 件):")
    for r in found:
        print(f"  - {r['title_name']}  [{r['id']}]")

    remove_ids = [r["id"] for r in found]

    # 名前で見つからなかったものを警告
    found_names = {r["title_name"] for r in found}
    for name in REMOVE_TITLES:
        if name not in found_names:
            print(f"  ※ 見つからなかったタイトル: {name}")

    # 2. 影響を受けるイベント ID を収集
    egt_result = (
        db.table("event_game_titles")
        .select("event_id, game_title_id")
        .in_("game_title_id", remove_ids)
        .execute()
    )
    affected_event_ids = list({r["event_id"] for r in (egt_result.data or [])})
    print(f"\n影響イベント数: {len(affected_event_ids)} 件")

    # 3. event_game_titles から除外タイトルの紐づけを削除
    del_egt = (
        db.table("event_game_titles")
        .delete()
        .in_("game_title_id", remove_ids)
        .execute()
    )
    print(f"event_game_titles 削除: {len(del_egt.data or [])} レコード")

    # 4. game_titles 本体を削除
    del_gt = (
        db.table("game_titles")
        .delete()
        .in_("id", remove_ids)
        .execute()
    )
    print(f"game_titles 削除: {len(del_gt.data or [])} レコード")

    # 5. 影響イベントのうち、game_titles が残っていないものを is_published = false に
    unpublished = []
    for event_id in affected_event_ids:
        remaining = (
            db.table("event_game_titles")
            .select("game_title_id")
            .eq("event_id", event_id)
            .execute()
        )
        if not remaining.data:
            db.table("events").update({"is_published": False}).eq("id", event_id).execute()
            unpublished.append(event_id)

    if unpublished:
        print(f"\n非表示にしたイベント ({len(unpublished)} 件):")
        # イベント名も取得して表示
        events = (
            db.table("events")
            .select("id, event_name, start_datetime")
            .in_("id", unpublished)
            .execute()
        )
        for e in (events.data or []):
            print(f"  - {e['event_name']}  ({e['start_datetime'][:10]})")
    else:
        print("\n非表示にしたイベントはありません（すべて他のゲームタイトルが残っていました）。")

    print("\n完了。")


if __name__ == "__main__":
    run()
