from supabase import create_client, Client
from utils.config import SUPABASE_URL, SUPABASE_SECRET_KEY

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    return _client
