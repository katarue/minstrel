import json
import anthropic
from utils.config import ANTHROPIC_API_KEY

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

EXTRACTION_SYSTEM = """
あなたはゲーム音楽コンサートの情報を構造化するアシスタントです。
与えられたHTMLまたはテキストから、以下のJSONスキーマに従って情報を抽出してください。
抽出できない項目はnullにしてください。日時はISO 8601形式（JST）で返してください。

【game_titles の判定基準】
game_titles には「ゲームが原作（発祥）のタイトル」のみを含めてください。
- 含める例: ファイナルファンタジー、ゼルダの伝説、ポケモン、ドラゴンクエスト、モンスターハンター、プリンセスコネクト
- 除外する例: ラブライブ！（アニメ原作）、アイマス（アニメ・メディアミックス原作）、進撃の巨人（漫画原作）、鬼滅の刃（漫画原作）
- 判断基準: そのIPが「最初にゲームとしてリリースされたか」。後からゲーム化されたアニメ・漫画・映画原作は除外。
- 演奏するゲーム音楽が一切ない（アニメ・映画・ポップス等のみ）場合は空リスト [] を返してください。

【organizer_official_url の判定基準】
テキスト末尾に「【外部リンク候補】」として URL リストが提示される場合があります。
その中から主催者・演奏団体自身が運営する公式ウェブサイトの URL を1つだけ選んでください。
- 含める: 楽団・主催団体の独自ドメインサイト（例: musicengine-info.net, orch-example.jp）
- 除外: チケット販売サイト（eplus, teket, pia, lawson, peatix, livepocket 等）
- 除外: SNS（Twitter/X, Instagram, YouTube, Facebook 等）
- 除外: ファンクラブ・会員管理サービス（ftaj.jp, fanicon.net 等）
- 除外: 地図・ユーティリティサービス
候補に公式サイトらしき URL がなければ null を返してください。
"""

EXTRACTION_SCHEMA = {
    "title": "string",
    "start_datetime": "ISO8601 string or null",
    "end_datetime": "ISO8601 string or null",
    "venue": "string or null",
    "prefecture": "都道府県名（例: 東京都、神奈川県、大阪府）or null。「関東」「関西」「中部」などの地域名は不可。会場住所から都道府県を推定すること。不明な場合は null。",
    "organizer_name": "string or null",
    "organizer_official_url": "主催者・演奏団体の公式ウェブサイトURL（チケットサイト・SNS・会員管理サービスは除く）or null",
    "ticket_url": "string or null",
    "description": "100〜200字の日本語要約 or null",
    "game_titles": ["ゲームが原作（発祥）のタイトル名のみ。アニメ・漫画・映画原作は除く。"],
    "is_cancelled": "boolean",
    "source_url": "string",
}


ANNOUNCEMENT_SYSTEM = """
あなたはゲーム音楽コンサートの告知ツイートを判定するアシスタントです。
与えられたテキストが「今後開催されるコンサートの告知」かどうかを判定し、
確度スコア（0-100）を返してください。
"""

ANNOUNCEMENT_SCHEMA = {
    "is_announcement": "boolean: 告知ツイートか（true/false）",
    "announcement_score": "integer 0-100: 告知である確度",
    "reason": "string: 判定理由（1行）",
}

NEGATIVE_KEYWORDS = [
    "行ってきた", "行ってきました", "感想", "楽しかった", "最高だった",
    "終演", "終わった", "終わりました", "お疲れ様", "セットリスト", "セトリ",
    "ブラボー", "アーカイブ配信", "見てきた",
]

POSITIVE_KEYWORDS = [
    "開催", "開演", "チケット", "発売", "予約", "申込", "入場",
    "演奏会", "コンサート", "公演", "出演", "日時", "会場",
]


def score_announcement(raw_text: str) -> int:
    """
    ツイートが告知かどうかを Claude で判定し、確度スコア（0-100）を返す。
    事前のヒューリスティックフィルタを通過しなければ Claude を呼ばない。
    """
    # ヒューリスティック: ネガティブキーワードが多ければ即 0
    neg_count = sum(1 for kw in NEGATIVE_KEYWORDS if kw in raw_text)
    if neg_count >= 2:
        return 0

    # ヒューリスティック: ポジティブキーワードが少なければ即 0
    pos_count = sum(1 for kw in POSITIVE_KEYWORDS if kw in raw_text)
    if pos_count == 0:
        return 0

    prompt = f"""以下のテキストはゲーム音楽コンサートの告知ツイートですか？

テキスト:
{raw_text[:1000]}

以下のJSONスキーマで返してください:
{json.dumps(ANNOUNCEMENT_SCHEMA, ensure_ascii=False)}

JSONのみ返してください。"""

    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
            system=ANNOUNCEMENT_SYSTEM,
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        parsed = json.loads(text.strip())
        return int(parsed.get("announcement_score", 0))
    except Exception:
        return 0


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
