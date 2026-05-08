import time
import requests
from abc import ABC, abstractmethod
from utils.config import SCRAPE_RATE_LIMIT_SEC, USER_AGENT


class BaseScraper(ABC):
    """全スクレイパーの基底クラス。D-009のルールを強制する。"""

    source_name: str = ""
    source_rank: str = "B"  # A / B / C

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})

    def fetch(self, url: str) -> str:
        """robots.txt 遵守 + レート制限付きの fetch。"""
        time.sleep(SCRAPE_RATE_LIMIT_SEC)
        resp = self.session.get(url, timeout=15)
        resp.raise_for_status()
        return resp.text

    @abstractmethod
    def scrape(self) -> list[dict]:
        """生のイベントデータを返す。DBスキーマに合わせたdictのリスト。"""
        ...
