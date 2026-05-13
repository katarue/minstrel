"""
エンティティ・レゾリューション: ハードキーによる同一イベント判定と統合ロジック。

フロー:
  1. source_url が event_sources に既存 → スキップ（完全重複）
  2. 取得データに ticket_url / official_url が含まれる
       → event_external_ids を検索
       → 一致あり: 既存 event に紐付け + 補完フィールド更新
       → 一致なし: 新規 event を作成
  3. ハードキーなし → 新規 event を作成
     ※ タイトル類似度によるソフトマージは行わない（誤マージ防止）
        類似候補は match_status='review_needed' でキューに積む
"""

import re
import unicodedata
from urllib.parse import urlparse, urlunparse


def _normalize_title(title: str) -> str:
    """重複検知用タイトル正規化（比較専用）。
    NFKC 正規化（全角→半角統一）+ 空白除去 + 小文字化。
    DB 保存値は変更しない。
    """
    normalized = unicodedata.normalize("NFKC", title)
    return "".join(normalized.split()).lower()


# チケット・公式URLとして認識するドメイン
_TICKET_DOMAINS = {
    "teket.jp",
    "peatix.com",
    "passmarket.yahoo.co.jp",
    "eplus.jp",
    "l-tike.com",
    "pia.jp",
    "t.livepocket.jp",
    "livepocket.jp",
    "kokucheese.com",
    "ptix.co",           # peatix の短縮ドメイン
    "ticket.pia.jp",     # チケットぴあ詳細ページのドメイン
}


def normalize_url(url: str) -> str:
    """URLからクエリパラメータ・フラグメントを除去して正規化する。"""
    if not url:
        return url
    parsed = urlparse(url.strip())
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def classify_url(url: str) -> str | None:
    """
    URLの種別を返す。
    Returns: 'ticket_url' | 'official_url' | None（対象外）
    """
    if not url:
        return None
    try:
        domain = urlparse(url).netloc.lstrip("www.")
        if any(domain == d or domain.endswith("." + d) for d in _TICKET_DOMAINS):
            return "ticket_url"
    except Exception:
        pass
    return None


def extract_hard_keys(event: dict) -> list[tuple[str, str]]:
    """
    イベントデータから (id_type, normalized_value) のリストを抽出する。
    例: [('ticket_url', 'https://teket.jp/1234/5678')]
    """
    keys = []

    # ticket_url（単一）
    ticket_url = event.get("ticket_url") or ""
    if ticket_url:
        id_type = classify_url(ticket_url)
        if id_type:
            keys.append((id_type, normalize_url(ticket_url)))

    # ticket_urls（複数: {"primary": "...", "secondary": "..."}）
    ticket_urls = event.get("ticket_urls") or {}
    if isinstance(ticket_urls, dict):
        for v in ticket_urls.values():
            if v and isinstance(v, str):
                id_type = classify_url(v)
                if id_type:
                    norm = normalize_url(v)
                    if (id_type, norm) not in keys:
                        keys.append((id_type, norm))

    # source_url がチケットURLの場合（teket スクレイパーはここに入る）
    source_url = event.get("source_url") or ""
    if source_url:
        id_type = classify_url(source_url)
        if id_type:
            norm = normalize_url(source_url)
            if (id_type, norm) not in keys:
                keys.append((id_type, norm))

    return keys


def find_existing_event(db, hard_keys: list[tuple[str, str]]) -> str | None:
    """
    event_external_ids テーブルを検索し、一致する event_id を返す。
    なければ None。
    """
    if not hard_keys:
        return None

    for id_type, value in hard_keys:
        result = (
            db.table("event_external_ids")
            .select("event_id")
            .eq("id_type", id_type)
            .eq("normalized_value", value)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["event_id"]

    return None


def find_existing_event_by_name_date(
    db,
    event_name: str,
    start_datetime: str,
    organizer_id: str | None = None,
) -> str | None:
    """
    イベント名（正規化後一致）+ 開催日 [+ オーガナイザー] で既存イベントを検索する。
    ハードキーで見つからなかった場合の重複防止として使用。

    organizer_id が渡された場合はオーガナイザーも一致条件に加える（誤マージ防止）。
    正規化: NFKC（全角→半角）+ 空白除去 + 小文字化。
    """
    if not event_name or not start_datetime:
        return None

    date_str = start_datetime[:10]
    normalized_query = _normalize_title(event_name)

    query = (
        db.table("events")
        .select("id, event_name")
        .gte("start_datetime", f"{date_str}T00:00:00+00:00")
        .lt("start_datetime", f"{date_str}T23:59:59+00:00")
    )
    if organizer_id:
        query = query.eq("organizer_id", organizer_id)

    result = query.execute()
    for row in result.data or []:
        if _normalize_title(row["event_name"]) == normalized_query:
            return row["id"]
    return None


def save_external_ids(db, event_id: str, hard_keys: list[tuple[str, str]]) -> None:
    """event_external_ids にハードキーを登録する（UPSERT）。"""
    for id_type, value in hard_keys:
        try:
            db.table("event_external_ids").upsert(
                {"event_id": event_id, "id_type": id_type, "normalized_value": value},
                on_conflict="id_type,normalized_value",
            ).execute()
        except Exception as e:
            print(f"[er] external_id upsert failed ({id_type}={value}): {e}")


def save_event_source(
    db,
    source_url: str,
    source_name: str,
    raw_data: dict,
    event_id: str | None,
    match_status: str,
) -> bool:
    """
    event_sources に生データを記録する。
    source_url が既存の場合は False を返す（呼び出し元はスキップ）。
    新規記録なら True を返す。
    """
    try:
        db.table("event_sources").insert(
            {
                "event_id": event_id,
                "source_name": source_name,
                "source_url": source_url,
                "raw_data": raw_data,
                "match_status": match_status,
            }
        ).execute()
        return True
    except Exception as e:
        # UNIQUE 制約違反 = 既に処理済みの source_url
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            return False
        print(f"[er] event_sources insert failed ({source_url}): {e}")
        return False


# ゲームタイトル正規化: 通称・略称 → 正式名称へのマッピング
_TITLE_ALIASES: dict[str, str] = {
    "ポケモン": "ポケットモンスター",
    "ドラクエ": "ドラゴンクエスト",
    "DQ": "ドラゴンクエスト",
    "FF": "ファイナルファンタジー",
    "ゼルダ": "ゼルダの伝説",
    "マリオ": "スーパーマリオ",
}


def normalize_game_title(title: str) -> str:
    """通称・略称を正式タイトルに変換する。"""
    stripped = title.strip()
    return _TITLE_ALIASES.get(stripped, stripped)


def save_game_titles(db, event_id: str, titles: list[str]) -> None:
    """game_titles に find-or-create して event_game_titles に紐づける。"""
    for title in titles:
        if not title or not title.strip():
            continue
        name = normalize_game_title(title)
        existing = db.table("game_titles").select("id").eq("title_name", name).limit(1).execute()
        if existing.data:
            gt_id = existing.data[0]["id"]
        else:
            created = db.table("game_titles").insert({"title_name": name}).execute()
            if not created.data:
                continue
            gt_id = created.data[0]["id"]
        try:
            db.table("event_game_titles").insert(
                {"event_id": event_id, "game_title_id": gt_id}
            ).execute()
        except Exception:
            pass  # 重複は無視


def find_or_create_organizer(
    db,
    organizer_name: str,
    x_url: str | None = None,
    official_url: str | None = None,
) -> str | None:
    """organizer_name で organizers テーブルを検索し、なければ作成して ID を返す。
    x_url / official_url が渡された場合、未設定のフィールドのみ補完する。
    """
    if not organizer_name or not organizer_name.strip():
        return None
    name = organizer_name.strip()
    result = (
        db.table("organizers")
        .select("id, x_url, official_site_url")
        .eq("name", name)
        .limit(1)
        .execute()
    )
    if result.data:
        organizer_id: str = result.data[0]["id"]
        # 未設定フィールドのみ補完（既存値は上書きしない）
        updates: dict = {}
        if x_url and not result.data[0].get("x_url"):
            updates["x_url"] = x_url
        if official_url and not result.data[0].get("official_site_url"):
            updates["official_site_url"] = official_url
        if updates:
            db.table("organizers").update(updates).eq("id", organizer_id).execute()
        return organizer_id

    insert_data: dict = {"name": name}
    if x_url:
        insert_data["x_url"] = x_url
    if official_url:
        insert_data["official_site_url"] = official_url
    created = db.table("organizers").insert(insert_data).execute()
    if created.data:
        return created.data[0]["id"]
    return None


def merge_fields(existing: dict, new_event: dict, source_name: str) -> dict:
    """
    既存イベントに新しいソースのデータを補完マージする。
    ルール:
      - 日時・会場・タイトル: 既存値がある場合は上書きしない（高ランクソース優先）
      - 画像 URL: 既存が空の場合のみ補完（X からの画像を埋める）
      - ticket_urls: 既存の JSONB にキーを追加（上書きしない）
    """
    updates: dict = {}

    # 画像補完（teket は画像を持たないことが多い）
    if not existing.get("flyer_image_url") and new_event.get("flyer_image_url"):
        updates["flyer_image_url"] = new_event["flyer_image_url"]

    # チケットURL補完
    existing_tickets: dict = existing.get("ticket_urls") or {}
    new_ticket = new_event.get("ticket_url") or ""
    if new_ticket and "primary" not in existing_tickets:
        updates["ticket_urls"] = {"primary": new_ticket, **existing_tickets}

    # confidence_score: 高い方を採用
    new_score = new_event.get("confidence_score")
    if new_score is not None:
        new_score_int = int(new_score * 100) if isinstance(new_score, float) else int(new_score)
        if (existing.get("confidence_score") or 0) < new_score_int:
            updates["confidence_score"] = new_score_int

    return updates
