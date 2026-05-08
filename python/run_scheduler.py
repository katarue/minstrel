"""
Prefect スケジューラー起動スクリプト（2-F-2）

起動方法:
  cd python
  .venv/Scripts/python run_scheduler.py

3日に1回・午前9時（JST = UTC+00:00 の 00:00）に collect_flow を実行する。
このプロセスが起動中である限りスケジュールが維持される。
プロセスを止めると停止するので、常駐させる場合は Task Scheduler や pm2 で管理すること。
"""
from flows.flow_collect import collect_flow

if __name__ == "__main__":
    collect_flow.serve(
        name="minstrel-collect-scheduled",
        cron="0 0 */3 * *",  # 3日おき UTC 00:00 = JST 09:00
    )
