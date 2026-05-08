import json
import anthropic
from utils.config import ANTHROPIC_API_KEY

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

EXTRACTION_SYSTEM = """
あなたはゲーム音楽コンサートの情報を構造化するアシスタントです。
与えられたHTMLまたはテキストから、以下のJSONスキーマに従って情報を抽出してください。
抽出できない項目はnullにしてください。日時はISO 8601形式（JST）で返してください。
"""

EXTRACTION_SCHEMA = {
    "title": "string",
    "start_datetime": "ISO8601 string or null",
    "end_datetime": "ISO8601 string or null",
    "venue": "string or null",
    "prefecture": "string or null",
    "organizer_name": "string or null",
    "ticket_url": "string or null",
    "description": "100〜200字の日本語要約 or null",
    "game_titles": ["string"],
    "is_cancelled": "boolean",
    "source_url": "string",
}


def extract_event(raw_text: str, source_url: str) -> dict | None:
    prompt = f"""以下のテキストからコンサート情報を抽出してください。

出典URL: {source_url}

テキスト:
{raw_text[:4000]}

以下のJSONスキーマで返してください:
{json.dumps(EXTRACTION_SCHEMA, ensure_ascii=False, indent=2)}

JSONのみ返してください。他のテキストは不要です。"""

    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
        system=EXTRACTION_SYSTEM,
    )

    try:
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        parsed = json.loads(text.strip())
        # Claudeがリストを返した場合は先頭要素を使用
        if isinstance(parsed, list):
            return parsed[0] if parsed else None
        return parsed
    except (json.JSONDecodeError, IndexError):
        return None
