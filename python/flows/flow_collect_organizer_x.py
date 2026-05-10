"""
演奏団体 X プロフィール収集フロー

スケジュール: 月1回 06:00 JST（1日）
"""
from prefect import flow, task

from scrapers.scraper_organizer_x import scrape_organizer_x

FLOW_NAME = "minstrel-collect-organizer-x"


@task
def fetch_organizer_profiles() -> int:
    return scrape_organizer_x()


@flow(name=FLOW_NAME, log_prints=True)
def collect_organizer_x_flow():
    """月1回: 演奏団体の X プロフィール画像と最終投稿日時を更新する"""
    try:
        updated = fetch_organizer_profiles()
        print(f"organizer_x updated: {updated} 件")
    except Exception as e:
        print(f"[error] {e}")
        raise


if __name__ == "__main__":
    collect_organizer_x_flow()
