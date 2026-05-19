"""
X予約投稿フロー

scheduled_posts テーブルの pending レコードを5分ごとにチェックし、
scheduled_at を過ぎたものを X に投稿する。

競合回避: 月曜・金曜 08:55〜09:15 JST は flow_post_weekly.py との競合を避けるためスキップ。
取りこぼし: 24時間以上前の pending は自動キャンセル扱いとする。
"""

import time
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from prefect import flow, task, get_run_logger

load_dotenv()

from utils.db import get_client  # noqa: E402
from utils.x_poster import post_tweet_v2  # noqa: E402

JST = timezone(timedelta(hours=9))
MAX_PER_RUN = 10
POST_INTERVAL_SEC = 60
RETRY_LIMIT = 3
STALE_HOURS = 24

# 月曜=0, 金曜=4（flow_post_weekly.py の実行日）
WEEKLY_BLACKOUT_DAYS = {0, 4}
WEEKLY_BLACKOUT_START_MIN = 8 * 60 + 55   # 08:55
WEEKLY_BLACKOUT_END_MIN   = 9 * 60 + 15   # 09:15


def _is_weekly_blackout(now_jst: datetime) -> bool:
    """月曜・金曜の 08:55〜09:15 JST は True を返す。"""
    if now_jst.weekday() not in WEEKLY_BLACKOUT_DAYS:
        return False
    current_min = now_jst.hour * 60 + now_jst.minute
    return WEEKLY_BLACKOUT_START_MIN <= current_min < WEEKLY_BLACKOUT_END_MIN


@task
def cancel_stale_posts() -> int:
    """24時間以上前の pending レコードをキャンセルに変更する。"""
    logger = get_run_logger()
    threshold = (datetime.now(timezone.utc) - timedelta(hours=STALE_HOURS)).isoformat()
    result = get_client().from_("scheduled_posts").update({
        "status": "cancelled",
        "error_message": "24時間以上経過のため自動キャンセル",
    }).eq("status", "pending").lt("scheduled_at", threshold).execute()
    count = len(result.data or [])
    if count:
        logger.warning(f"[scheduled] 期限切れキャンセル: {count} 件")
    return count


@task
def fetch_due_posts() -> list[dict]:
    """投稿時刻を過ぎた pending レコードを最大 MAX_PER_RUN 件取得する。"""
    now_utc = datetime.now(timezone.utc).isoformat()
    result = (
        get_client()
        .from_("scheduled_posts")
        .select("*")
        .eq("status", "pending")
        .lte("scheduled_at", now_utc)
        .lt("retry_count", RETRY_LIMIT)
        .order("scheduled_at", desc=False)
        .limit(MAX_PER_RUN)
        .execute()
    )
    return result.data or []


@task
def post_and_update(post: dict) -> None:
    logger = get_run_logger()
    db = get_client()
    image_urls: list[str] = post.get("image_urls") or []

    logger.info(f"[scheduled] 投稿開始 id={post['id']} scheduled_at={post['scheduled_at']}")
    result = post_tweet_v2(post["body"], image_urls if image_urls else None)

    if result.success:
        db.from_("scheduled_posts").update({
            "status": "posted",
            "posted_at": datetime.now(timezone.utc).isoformat(),
            "posted_tweet_id": result.tweet_id,
            "posted_tweet_url": result.tweet_url,
            "error_message": None,
        }).eq("id", post["id"]).execute()
        logger.info(f"[scheduled] 投稿完了 tweet_id={result.tweet_id}")
    else:
        new_retry = post["retry_count"] + 1
        new_status = "cancelled" if new_retry >= RETRY_LIMIT else "failed"
        db.from_("scheduled_posts").update({
            "status": new_status,
            "retry_count": new_retry,
            "error_message": result.error,
        }).eq("id", post["id"]).execute()
        logger.warning(
            f"[scheduled] 投稿失敗 retry={new_retry} status={new_status}: {result.error}"
        )


@flow(
    name="minstrel-post-scheduled",
    description="X予約投稿フロー（5分ごと実行）",
)
def post_scheduled_flow() -> None:
    logger = get_run_logger()
    now_jst = datetime.now(JST)

    if _is_weekly_blackout(now_jst):
        logger.info(
            f"[scheduled] weekly blackout ({now_jst.strftime('%H:%M')} JST, "
            f"{'月' if now_jst.weekday() == 0 else '金'}曜) → スキップ"
        )
        return

    cancel_stale_posts()

    due_posts = fetch_due_posts()
    if not due_posts:
        logger.info("[scheduled] 実行対象なし")
        return

    logger.info(f"[scheduled] 実行対象: {len(due_posts)} 件")
    for i, post in enumerate(due_posts):
        if i > 0:
            logger.info(f"[scheduled] レート制限対策: {POST_INTERVAL_SEC}秒待機")
            time.sleep(POST_INTERVAL_SEC)
        post_and_update(post)


# ローカル実行用
if __name__ == "__main__":
    post_scheduled_flow()
