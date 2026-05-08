"""
週次 X 投稿フロー（3-C）

月曜 09:00 JST: 今週のコンサート一覧を投稿
金曜 09:00 JST: 近日開催（30日以内）コンサート一覧を投稿
"""
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from prefect import flow, task

load_dotenv()

from utils.db import get_client  # noqa: E402
from utils.x_poster import post_tweet  # noqa: E402

JST = timezone(timedelta(hours=9))
SITE_URL = "https://minstrel.live"
WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"]


def _fmt_date(iso: str) -> str:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(JST)
    return f"{dt.month}/{dt.day}({WEEKDAYS[dt.weekday()]})"


def _truncate(name: str, limit: int = 22) -> str:
    return name[:limit] + "…" if len(name) > limit else name


def _event_line(ev: dict) -> str:
    return f"📅 {_fmt_date(ev['start_datetime'])} {_truncate(ev['event_name'])}（{ev.get('prefecture', '')}）"


@task
def fetch_this_week_events() -> list[dict]:
    now = datetime.now(JST).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = now + timedelta(days=7)
    result = get_client().from_("events").select(
        "event_name, start_datetime, prefecture"
    ).eq("is_published", True).gte(
        "start_datetime", now.astimezone(timezone.utc).isoformat()
    ).lt(
        "start_datetime", week_end.astimezone(timezone.utc).isoformat()
    ).order("start_datetime").execute()
    return result.data or []


@task
def fetch_upcoming_events() -> list[dict]:
    now = datetime.now(JST)
    end = now + timedelta(days=30)
    result = get_client().from_("events").select(
        "event_name, start_datetime, prefecture"
    ).eq("is_published", True).gte(
        "start_datetime", now.astimezone(timezone.utc).isoformat()
    ).lt(
        "start_datetime", end.astimezone(timezone.utc).isoformat()
    ).order("start_datetime").execute()
    return result.data or []


def _build_tweet(header: str, events: list[dict], empty_msg: str) -> str:
    lines = [header, ""]
    if not events:
        lines.append(empty_msg)
    else:
        for ev in events[:5]:
            lines.append(_event_line(ev))
        if len(events) > 5:
            lines.append(f"他 {len(events) - 5} 件")
    lines += ["", f"詳細→ {SITE_URL}/concerts", "#ゲーム音楽 #コンサート"]
    return "\n".join(lines)


@flow(name="minstrel-post-monday")
def post_monday_flow():
    """月曜投稿: 今週のゲーム音楽コンサート"""
    events = fetch_this_week_events()
    text = _build_tweet(
        "🎵 今週のゲーム音楽コンサート",
        events,
        "今週は登録コンサートがありません。",
    )
    print(f"[post_monday] {len(events)} events, {len(text)} chars")
    post_tweet(text)


@flow(name="minstrel-post-friday")
def post_friday_flow():
    """金曜投稿: 近日開催のゲーム音楽コンサート（30日以内）"""
    events = fetch_upcoming_events()
    text = _build_tweet(
        "🎮 近日開催のゲーム音楽コンサート",
        events,
        "近日開催の登録コンサートはありません。",
    )
    print(f"[post_friday] {len(events)} events, {len(text)} chars")
    post_tweet(text)
