import json
import re
import anthropic
from utils.config import ANTHROPIC_API_KEY

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def enrich_event_fields(event_name: str, organizer: str = "") -> dict:
    """Claude web search でイベントの不足フィールドを補完する。
    Returns dict with keys: game_titles, venue_name, prefecture, start_time
    """
    org_str = f"（主催: {organizer}）" if organizer else ""
    prompt = f"""コンサート「{event_name}」{org_str}について、公式サイト・X（Twitter）・チケットサイト等をウェブ検索して以下の情報を収集してください。

ゲームタイトルは「最初にゲームとしてリリースされたタイトルのみ」（ビジュアルノベル含む。アニメ・漫画原作は除く）。シリーズ名で統一すること。

以下のJSON形式のみで返してください：
{{
  "game_titles": ["タイトル1", "タイトル2"],
  "venue_name": "会場名 または null",
  "prefecture": "都道府県名（例: 東京都）または null",
  "start_time": "HH:MM または null"
}}"""

    tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}]
    msgs = [{"role": "user", "content": prompt}]
    result_text = ""

    for _ in range(8):
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            tools=tools,
            messages=msgs,
        )
        text_block = next((b for b in reversed(resp.content) if b.type == "text"), None)
        if text_block:
            result_text = text_block.text
        if resp.stop_reason == "end_turn":
            break
        if resp.stop_reason == "tool_use":
            msgs.append({"role": "assistant", "content": resp.content})
            tool_results = [
                {"type": "tool_result", "tool_use_id": b.id, "content": ""}
                for b in resp.content if b.type == "tool_use"
            ]
            if tool_results:
                msgs.append({"role": "user", "content": tool_results})
        else:
            break

    try:
        clean = result_text.replace("```json", "").replace("```", "")
        m = re.search(r"\{[\s\S]*\}", clean)
        if m:
            return json.loads(m.group(0))
    except Exception:
        pass
    return {}
