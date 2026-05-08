import requests
from utils.config import DISCORD_WEBHOOK_URL


def notify_failure(flow_name: str, error: str) -> None:
    if not DISCORD_WEBHOOK_URL:
        return
    payload = {
        "content": f"🚨 **{flow_name}** 失敗\n```\n{error[:1800]}\n```"
    }
    try:
        requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=10)
    except Exception:
        pass


def notify_success(flow_name: str, scraped: int, inserted: int) -> None:
    if not DISCORD_WEBHOOK_URL:
        return
    payload = {
        "content": f"✅ **{flow_name}** 完了 — scraped: {scraped} / inserted: {inserted}"
    }
    try:
        requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=10)
    except Exception:
        pass
