"""
チケット発売日の scheduled_posts への事前登録モジュール。

ticket_sale_start が今日以降かつ is_published=true のイベントを対象に
scheduled_posts テーブルへ投稿を事前登録する。

投稿時刻: 発売日当日 12:00 JST（= 03:00 UTC）
重複防止: source_event_id が scheduled_posts に pending/posted で存在する場合はスキップ。

事前 DDL（Supabase SQL Editor）:
  ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS source_event_id UUID REFERENCES events(id);
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

_JST = timezone(timedelta(hours=9))
_HASHTAGS = "#ゲーム音楽 #コンサート #チケット発売"


def _today_jst() -> str:
    return datetime.now(_JST).date().isoformat()


def _format_date_jst(iso_str: str) -> str:
    _WEEKDAY_JA = ["月", "火", "水", "木", "金", "土", "日"]
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00")).astimezone(_JST)
        wd = _WEEKDAY_JA[dt.weekday()]
        return f"{dt.year}年{dt.month}月{dt.day}日({wd})"
    except Exception:
        return iso_str[:10]


def _compose_tweet(event: dict) -> str:
    name = event.get("event_name", "")
    if len(name) > 50:
        name = name[:49] + "…"

    date_str = ""
    if event.get("start_datetime"):
        date_str = _format_date_jst(event["start_datetime"])

    venue = event.get("venue_name") or event.get("prefecture") or ""
    if len(venue) > 20:
        venue = venue[:19] + "…"

    ticket_url: Optional[str] = event.get("source_url") or event.get("official_url")

    lines = ["🎫 本日チケット発売！", "", f"「{name}」"]
    if date_str or venue:
        meta = " @ ".join(filter(None, [date_str, venue]))
        lines.append(f"📅 {meta}")

    lines.append("")
    if ticket_url:
        lines.append(f"🎟 チケット購入 → {ticket_url}")

    lines.append("")
    lines.append("minstrel.live でゲーム音楽コンサート情報を配信中")
    lines.append("")
    lines.append(_HASHTAGS)

    return "\n".join(lines)


def _scheduled_at_utc(sale_date: str) -> str:
    """発売日の 12:00 JST を UTC ISO 文字列に変換する。"""
    dt_jst = datetime.fromisoformat(f"{sale_date}T12:00:00").replace(tzinfo=_JST)
    return dt_jst.astimezone(timezone.utc).isoformat()


def sync_ticket_sale_posts() -> int:
    """
    ticket_sale_start が今日以降の公開済みイベントを scheduled_posts に登録する。
    既に pending/posted のエントリ（source_event_id 一致）がある場合はスキップする。
    """
    from utils.db import get_client

    db = get_client()
    today = _today_jst()

    result = (
        db.table("events")
        .select(
            "id, event_name, start_datetime, venue_name, prefecture, "
            "source_url, official_url, flyer_image_url, key_visual_url, ticket_sale_start"
        )
        .eq("is_published", True)
        .gte("ticket_sale_start", today)
        .not_.is_("ticket_sale_start", "null")
        .execute()
    )

    events = result.data or []
    if not events:
        print(f"[ticket_scheduler] {today}: 対象イベントなし")
        return 0

    print(f"[ticket_scheduler] {today}: {len(events)} 件を確認")

    registered_result = (
        db.table("scheduled_posts")
        .select("source_event_id")
        .in_("status", ["pending", "posted"])
        .not_.is_("source_event_id", "null")
        .execute()
    )
    registered_ids = {row["source_event_id"] for row in (registered_result.data or [])}

    scheduled = 0
    for ev in events:
        if ev["id"] in registered_ids:
            continue

        tweet = _compose_tweet(ev)
        image_urls = [u for u in [ev.get("flyer_image_url"), ev.get("key_visual_url")] if u]
        scheduled_at = _scheduled_at_utc(ev["ticket_sale_start"])

        db.table("scheduled_posts").insert({
            "category": "ticket",
            "body": tweet,
            "scheduled_at": scheduled_at,
            "image_urls": image_urls,
            "source_event_id": ev["id"],
            "status": "pending",
            "retry_count": 0,
        }).execute()

        print(f"[ticket_scheduler] 登録: {ev['event_name'][:40]} → {ev['ticket_sale_start']} 12:00 JST")
        scheduled += 1

    print(f"[ticket_scheduler] {scheduled} 件を scheduled_posts に登録")
    return scheduled
