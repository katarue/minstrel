"""
チケット発売日当日に X（Twitter）へ告知ツイートを投稿するモジュール。

実行条件:
  - events.ticket_sale_start = 今日（JST）
  - events.is_published = true
  - events.ticket_announced_at IS NULL（重複投稿防止）

ツイート仕様:
  - フライヤー画像を必ず添付（flyer_image_url → key_visual_url の優先順）
  - チケットサイトへ直リンク（source_url → official_url の優先順）
  - 画像がない場合でもテキストのみで投稿する

事前 DDL（Supabase SQL Editor）:
  ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_announced_at TIMESTAMPTZ;
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


def announce_ticket_sales_today() -> int:
    """
    ticket_sale_start が今日（JST）かつ未告知のイベントを対象にツイートを投稿する。
    フライヤー画像を優先的に添付する。投稿後に ticket_announced_at を更新する。
    """
    from utils.db import get_client
    from utils.x_poster import post_tweet, post_tweet_with_image

    db = get_client()
    today = _today_jst()

    result = (
        db.table("events")
        .select(
            "id, event_name, start_datetime, venue_name, prefecture, "
            "source_url, official_url, tour_id, "
            "flyer_image_url, key_visual_url"
        )
        .eq("is_published", True)
        .eq("ticket_sale_start", today)
        .is_("ticket_announced_at", "null")
        .execute()
    )

    events = result.data or []
    if not events:
        print(f"[ticket_announce] {today}: 発売日対象イベントなし")
        return 0

    print(f"[ticket_announce] {today}: {len(events)} 件を処理")
    posted = 0
    for ev in events:
        tweet = _compose_tweet(ev)
        image_url: Optional[str] = ev.get("flyer_image_url") or ev.get("key_visual_url")

        if image_url:
            success = post_tweet_with_image(tweet, image_url)
        else:
            print(f"[ticket_announce] 画像なし、テキストのみで投稿: {ev.get('event_name', '')[:30]}")
            success = post_tweet(tweet)

        if success:
            db.table("events").update({
                "ticket_announced_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", ev["id"]).execute()
            posted += 1

    print(f"[ticket_announce] 投稿完了: {posted} / {len(events)} 件")
    return posted
