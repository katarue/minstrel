"""
IGDB カバー画像URLを全ゲームタイトルに付与する。

実行方法（python/ ディレクトリから）:
  python scripts/fetch_igdb_covers.py

動作:
  - igdb_cover_url が未設定のタイトルのみ処理（再実行安全）
  - 英語名がある場合は英語名で検索、なければ日本語名で検索
  - 見つかった場合: igdb_cover_url を t_cover_big サイズの URL で保存
  - 見つからなかった場合: スキップしてログ出力
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import requests
from utils.config import IGDB_CLIENT_ID, IGDB_CLIENT_SECRET
from utils.db import get_client

IGDB_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
IGDB_GAMES_URL = "https://api.igdb.com/v4/games"
RATE_LIMIT_SEC = 0.25  # 4 req/sec


def get_token() -> str:
    resp = requests.post(
        IGDB_TOKEN_URL,
        params={
            "client_id": IGDB_CLIENT_ID,
            "client_secret": IGDB_CLIENT_SECRET,
            "grant_type": "client_credentials",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def search_cover(query: str, token: str) -> str | None:
    """タイトル名でIGDBを検索し、カバー画像URLを返す。見つからなければ None。"""
    headers = {
        "Client-ID": IGDB_CLIENT_ID,
        "Authorization": f"Bearer {token}",
    }
    body = f'search "{query}"; fields name, cover.url; limit 1;'
    resp = requests.post(IGDB_GAMES_URL, headers=headers, data=body.encode("utf-8"), timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if not data:
        return None
    cover = data[0].get("cover")
    if not cover:
        return None
    url: str = cover.get("url", "")
    url = url.replace("t_thumb", "t_cover_big")
    if url.startswith("//"):
        url = "https:" + url
    return url or None


def build_search_candidates(title_name: str, english_name: str | None) -> list[str]:
    """検索クエリ候補を優先順に返す。コロンを除去したバリアントも含む。"""
    candidates: list[str] = []
    for name in ([english_name, title_name] if english_name else [title_name]):
        if not name:
            continue
        candidates.append(name)
        # コロンを除去したバリアントを追加（NieR:Automata → NieR Automata）
        without_colon = name.replace(":", " ").replace("  ", " ").strip()
        if without_colon != name:
            candidates.append(without_colon)
    return candidates


def run() -> None:
    if not IGDB_CLIENT_ID or not IGDB_CLIENT_SECRET:
        print("ERROR: IGDB_CLIENT_ID / IGDB_CLIENT_SECRET が .env に設定されていません。")
        sys.exit(1)

    db = get_client()

    result = db.table("game_titles").select("id, title_name, english_name, igdb_cover_url").order("title_name").execute()
    all_titles = result.data or []

    pending = [t for t in all_titles if not t.get("igdb_cover_url")]
    print(f"対象: {len(pending)} 件（全 {len(all_titles)} 件中、未取得のみ）\n")

    if not pending:
        print("すべてのタイトルにカバー画像が設定済みです。")
        return

    token = get_token()
    print("IGDB トークン取得完了\n")

    found = 0
    not_found = 0
    errors = 0

    for i, title in enumerate(pending, 1):
        name_ja: str = title["title_name"]
        name_en: str | None = title.get("english_name")

        candidates = build_search_candidates(name_ja, name_en)
        url: str | None = None

        for query in candidates:
            if not query:
                continue
            try:
                url = search_cover(query, token)
                time.sleep(RATE_LIMIT_SEC)
            except requests.RequestException as e:
                print(f"  [{i:3d}] ERROR {name_ja}: {e}")
                errors += 1
                break
            if url:
                break

        status = "✓" if url else "–"
        used_query = candidates[0] if url else name_ja
        print(f"  [{i:3d}/{len(pending)}] {status} {name_ja}  （検索: {used_query}）")

        if url:
            db.table("game_titles").update({"igdb_cover_url": url}).eq("id", title["id"]).execute()
            found += 1
        else:
            not_found += 1

    print(f"\n完了: 取得成功 {found} 件 / 見つからず {not_found} 件 / エラー {errors} 件")


if __name__ == "__main__":
    run()
