import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
TWITTERAPI_IO_KEY = os.environ.get("TWITTERAPI_IO_KEY", "")
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")
IGDB_CLIENT_ID = os.environ.get("IGDB_CLIENT_ID", "")
IGDB_CLIENT_SECRET = os.environ.get("IGDB_CLIENT_SECRET", "")
GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

# スクレイピング共通設定（D-009）
SCRAPE_RATE_LIMIT_SEC = 5
USER_AGENT = "Mozilla/5.0 (compatible; ConcertInfoBot/1.0)"
