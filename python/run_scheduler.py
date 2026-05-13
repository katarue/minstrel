"""
Minstrel スケジューラー

起動方法:
  # 収集フロー: 3日おき 09:00 JST
  cd python && .venv/Scripts/python run_scheduler.py --serve-scheduled

  # 放送収集フロー: 毎日 08:00 JST
  cd python && .venv/Scripts/python run_scheduler.py --serve-broadcasts

  # 投稿フロー: 月・金 09:00 JST
  cd python && .venv/Scripts/python run_scheduler.py --serve-post

  # 全フロー同時常駐
  cd python && .venv/Scripts/python run_scheduler.py --serve-all

  # 即時テスト実行
  cd python && .venv/Scripts/python run_scheduler.py --run-now
  cd python && .venv/Scripts/python run_scheduler.py --run-broadcasts
  cd python && .venv/Scripts/python run_scheduler.py --run-broadcasts-weekly
  cd python && .venv/Scripts/python run_scheduler.py --run-organizer-x
  cd python && .venv/Scripts/python run_scheduler.py --run-post-monday
  cd python && .venv/Scripts/python run_scheduler.py --run-post-friday
  cd python && .venv/Scripts/python run_scheduler.py --run-sync-following
  cd python && .venv/Scripts/python run_scheduler.py --run-sync-lists
"""
import argparse
import os
import sys

# Windows CP932 対策: stdout/stderr を UTF-8 に固定
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(__file__))

from flows.flow_collect import collect_flow
from flows.flow_collect_x import collect_x_flow
from flows.flow_collect_broadcasts import collect_broadcasts_flow, collect_broadcasts_weekly_flow
from flows.flow_collect_organizer_x import collect_organizer_x_flow
from flows.flow_post_weekly import post_friday_flow, post_monday_flow

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-now", action="store_true", help="チケット収集フロー即時実行")
    parser.add_argument("--run-x", action="store_true", help="X 収集フロー即時実行")
    parser.add_argument("--run-broadcasts", action="store_true", help="放送収集フロー即時実行（X監視）")
    parser.add_argument("--run-broadcasts-weekly", action="store_true", help="bangumi.org 週次収集フロー即時実行")
    parser.add_argument("--run-organizer-x", action="store_true", help="演奏団体 X プロフィール収集フロー即時実行")
    parser.add_argument("--run-post-monday", action="store_true", help="月曜投稿フロー即時実行")
    parser.add_argument("--run-post-friday", action="store_true", help="金曜投稿フロー即時実行")
    parser.add_argument("--run-sync-following", action="store_true", help="@minstrel_live フォローリスト同期")
    parser.add_argument("--run-sync-lists", action="store_true", help="X リスト → trust_tier 同期（即時）")
    parser.add_argument("--serve-scheduled", action="store_true", help="チケット収集フロー: 3日おき09:00 JST")
    parser.add_argument("--serve-x", action="store_true", help="X 収集フロー: 毎日07:00 JST")
    parser.add_argument("--serve-broadcasts", action="store_true", help="放送収集フロー: 毎日08:00 JST")
    parser.add_argument("--serve-post", action="store_true", help="投稿フロー: 月・金 09:00 JST")
    parser.add_argument("--serve-all", action="store_true", help="全フロー常駐")
    args = parser.parse_args()

    from prefect.client.schemas.schedules import CronSchedule

    if args.run_sync_following:
        from scripts.sync_x_following import run as sync_run
        sync_run()
    elif args.run_sync_lists:
        from scripts.sync_x_lists import sync as lists_sync
        lists_sync()
    elif args.run_now:
        collect_flow()
    elif args.run_x:
        collect_x_flow()
    elif args.run_broadcasts:
        collect_broadcasts_flow()
    elif args.run_broadcasts_weekly:
        collect_broadcasts_weekly_flow()
    elif args.run_organizer_x:
        collect_organizer_x_flow()
    elif args.run_post_monday:
        post_monday_flow()
    elif args.run_post_friday:
        post_friday_flow()
    elif args.serve_broadcasts:
        collect_broadcasts_flow.serve(
            name="minstrel-collect-broadcasts-scheduled",
            schedules=[CronSchedule(cron="0 8 * * *", timezone="Asia/Tokyo")],
        )
    elif args.serve_scheduled:
        collect_flow.serve(
            name="minstrel-collect-scheduled",
            schedules=[CronSchedule(cron="0 9 */3 * *", timezone="Asia/Tokyo")],
        )
    elif args.serve_x:
        collect_x_flow.serve(
            name="minstrel-collect-x-scheduled",
            schedules=[CronSchedule(cron="0 7 * * *", timezone="Asia/Tokyo")],
        )
    elif args.serve_post:
        from prefect.runner import Runner
        runner = Runner(name="minstrel-post-runner")
        runner.add_flow(
            post_monday_flow,
            name="minstrel-post-monday",
            schedules=[CronSchedule(cron="0 9 * * 1", timezone="Asia/Tokyo")],
        )
        runner.add_flow(
            post_friday_flow,
            name="minstrel-post-friday",
            schedules=[CronSchedule(cron="0 9 * * 5", timezone="Asia/Tokyo")],
        )
        runner.start()
    elif args.serve_all:
        from prefect.runner import Runner
        runner = Runner(name="minstrel-runner")
        runner.add_flow(
            collect_flow,
            name="minstrel-collect-scheduled",
            schedules=[CronSchedule(cron="0 9 */3 * *", timezone="Asia/Tokyo")],
        )
        runner.add_flow(
            collect_x_flow,
            name="minstrel-collect-x-scheduled",
            schedules=[CronSchedule(cron="0 7 * * *", timezone="Asia/Tokyo")],
        )
        runner.add_flow(
            collect_broadcasts_flow,
            name="minstrel-collect-broadcasts-scheduled",
            schedules=[CronSchedule(cron="0 8 * * *", timezone="Asia/Tokyo")],
        )
        runner.add_flow(
            collect_broadcasts_weekly_flow,
            name="minstrel-collect-broadcasts-weekly-scheduled",
            schedules=[CronSchedule(cron="0 7 */2 * *", timezone="Asia/Tokyo")],
        )
        runner.add_flow(
            collect_organizer_x_flow,
            name="minstrel-collect-organizer-x-scheduled",
            schedules=[CronSchedule(cron="0 6 1 * *", timezone="Asia/Tokyo")],
        )
        runner.add_flow(
            post_monday_flow,
            name="minstrel-post-monday",
            schedules=[CronSchedule(cron="0 9 * * 1", timezone="Asia/Tokyo")],
        )
        runner.add_flow(
            post_friday_flow,
            name="minstrel-post-friday",
            schedules=[CronSchedule(cron="0 9 * * 5", timezone="Asia/Tokyo")],
        )
        runner.start()
    else:
        collect_flow.serve(name="minstrel-collect")
