"""
Minstrel 定期収集スケジューラー（2-F-2）

AI News Video Pipeline の run パターンに合わせた構成。

起動方法:
  # スケジュール付き常駐（3日おき 09:00 JST）
  cd python
  .venv/Scripts/python run_scheduler.py --serve-scheduled

  # 即時1回実行（テスト用）
  .venv/Scripts/python run_scheduler.py --run-now
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from flows.flow_collect import collect_flow

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-now", action="store_true", help="即時1回実行")
    parser.add_argument("--serve-scheduled", action="store_true", help="3日おき09:00 JSTで自動実行")
    args = parser.parse_args()

    if args.run_now:
        collect_flow()
    elif args.serve_scheduled:
        from prefect.client.schemas.schedules import CronSchedule
        collect_flow.serve(
            name="minstrel-collect-scheduled",
            schedules=[CronSchedule(cron="0 9 */3 * *", timezone="Asia/Tokyo")],
        )
    else:
        collect_flow.serve(name="minstrel-collect")
