"""重複イベントの根本原因調査スクリプト。"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.config import SUPABASE_URL, SUPABASE_SECRET_KEY
from supabase import create_client

db = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

# ── 1. ピアノ関連イベント ──────────────────────────────────────────────────
print("=== ピアノ関連イベント ===")
r = db.table("events").select(
    "id, event_name, start_datetime, venue_name, prefecture, source_url, ticket_urls"
).ilike("event_name", "%ピアノ%").execute()
for e in r.data:
    print(f"  id={e['id'][:8]}  name={e['event_name']!r}")
    dt = e["start_datetime"][:10] if e["start_datetime"] else None
    print(f"    date={dt}  venue={e['venue_name']!r}  pref={e['prefecture']!r}")
    print(f"    source_url={e['source_url']!r}")
    print(f"    ticket_urls={e['ticket_urls']}")

    # 各イベントの event_external_ids を確認
    ext = db.table("event_external_ids").select("id_type, normalized_value").eq("event_id", e["id"]).execute()
    for x in ext.data:
        print(f"    external_id: {x['id_type']} = {x['normalized_value']!r}")

    # event_sources も確認
    src = db.table("event_sources").select("source_name, source_url").eq("event_id", e["id"]).execute()
    for s in src.data:
        print(f"    source: {s['source_name']} {s['source_url']!r}")
    print()

# ── 2. Hollow Knight 関連イベント ─────────────────────────────────────────
print("=== Hollow Knight 関連イベント ===")
r2 = db.table("events").select(
    "id, event_name, start_datetime, venue_name, prefecture, source_url, ticket_urls"
).ilike("event_name", "%Hollow Knight%").execute()
for e in r2.data:
    print(f"  id={e['id'][:8]}  name={e['event_name']!r}")
    dt = e["start_datetime"][:10] if e["start_datetime"] else None
    print(f"    date={dt}  venue={e['venue_name']!r}  pref={e['prefecture']!r}")
    print(f"    source_url={e['source_url']!r}")
    print(f"    ticket_urls={e['ticket_urls']}")

    ext = db.table("event_external_ids").select("id_type, normalized_value").eq("event_id", e["id"]).execute()
    for x in ext.data:
        print(f"    external_id: {x['id_type']} = {x['normalized_value']!r}")

    src = db.table("event_sources").select("source_name, source_url").eq("event_id", e["id"]).execute()
    for s in src.data:
        print(f"    source: {s['source_name']} {s['source_url']!r}")
    print()
