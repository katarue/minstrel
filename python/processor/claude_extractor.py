import json
import anthropic
from utils.config import ANTHROPIC_API_KEY

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

_GAME_TITLES_CRITERIA = """
【game_titles の判定基準】
game_titles には「ビデオゲーム・コンピューターゲームが最初の発表媒体であるタイトル」のみを含めてください。
- 含める: RPG、アクション、ADV、ビジュアルノベル、ノベルゲーム等すべてのゲームジャンル
  例: ファイナルファンタジー、ゼルダの伝説、ポケモン、ドラゴンクエスト、モンスターハンター、
      Steins;Gate（ビジュアルノベル）、逆転裁判、ダンガンロンパ、ヴァルキリープロファイル
- 除外: アニメ・漫画・映画・ライトノベルが「最初の発表媒体」であるもの
  例: ラブライブ！（アニメ原作）、進撃の巨人（漫画原作）、鬼滅の刃（漫画原作）
- 判断基準: 「そのIPが最初にゲームとしてリリースされたか」。ゲームと同時・ゲームが先ならば含める。
- 演奏するゲーム音楽が一切ない（アニメ・映画・ポップス等のみ）場合は空リスト [] を返してください。
- タイトルの粒度は以下のルールに従うこと:
  【特定タイトルが明記されている場合】そのタイトルをそのまま抽出する。
    例:「ファイナルファンタジーXIV」→「ファイナルファンタジーXIV」、「ゼルダの伝説 ブレス オブ ザ ワイルド」→「ゼルダの伝説 ブレス オブ ザ ワイルド」
  【複数タイトルをまとめたシリーズ演奏・シリーズ名のみ明記の場合】シリーズ名で登録する。
    例:「FFシリーズの名曲」「Distant Worlds: Music from FINAL FANTASY」→「ファイナルファンタジー」
    例:「ゼルダの伝説シリーズメドレー」→「ゼルダの伝説」
"""

_GAME_MUSIC_CLASSIFICATION = """
【is_game_music_event の判定基準】
true にする条件（いずれか1つ以上）:
- ゲームタイトルの楽曲が演奏される・演奏される可能性がある
- 演奏者・作曲者がゲーム音楽で著名（例: 植松伸夫、光田康典、崎元仁、古代祐三、下村陽子など）
- ゲーム会社（任天堂、スクウェア・エニックス、コナミ、セガ等）が主催または共催するコンサート
- イベント名・説明にゲーム音楽関連のキーワードが含まれる（「ゲーム音楽」「Game Music」等）

false にする条件（明確にゲームと無関係な場合）:
- アニメ・漫画・映画原作IPのみ（ゲーム起源なし）
- 一般バンド・アーティストのライブ（ゲーム音楽との接点が皆無）
- クラシックコンサート・オーケストラ（ゲーム曲を一切演奏しない）
- 格闘技・スポーツ等の非音楽イベント

判断に迷う場合は true にしてください（人間が最終確認します）。

【game_music_reason の書き方】
1〜2行で具体的に記述してください:
- 関連あり例: 「ゲームタイトル『○○』の楽曲を演奏」「作曲家○○（FF・DQ等で著名）のコンサート」
- 関連なし例: 「アニメ『○○』原作のイベント。ゲーム起源なし」「一般バンドのライブ。ゲーム音楽との関連なし」
"""

_GAME_MUSIC_CLASSIFICATION_STRICT = """
【is_game_music_event の判定基準（厳格モード）】
true にする条件（いずれか1つ以上が明確に確認できる場合のみ）:
- ゲームタイトルの楽曲が演奏されることが明記されている
- 演奏者・作曲者がゲーム音楽で著名であることが明記されている
- ゲーム会社が主催または共催していることが明記されている
- イベント名・プログラムにゲーム音楽関連のキーワードが含まれている

false にする条件:
- 上記のいずれも確認できない
- アニメ・漫画・映画原作IPのみ（ゲーム起源なし）
- 一般バンド・アーティストのライブ
- クラシックコンサート・オーケストラ（ゲーム曲の記載なし）
- 情報が不十分で判断できない

判断に迷う場合は false にしてください。情報が不十分な場合も false にしてください。

【game_music_reason の書き方】
1〜2行で具体的に記述してください:
- 関連あり例: 「ゲームタイトル『○○』の楽曲を演奏」「作曲家○○（FF・DQ等で著名）のコンサート」
- 関連なし例: 「アニメ『○○』原作のイベント。ゲーム起源なし」「一般バンドのライブ。ゲーム音楽との関連なし」
"""

_ORGANIZER_URL_CRITERIA = """
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

EXTRACTION_SYSTEM = """
あなたはゲーム音楽コンサートの情報を構造化するアシスタントです。
与えられたHTMLまたはテキストから、以下のJSONスキーマに従って情報を抽出してください。
抽出できない項目はnullにしてください。日時はISO 8601形式（JST）で返してください。
""" + _GAME_TITLES_CRITERIA + _GAME_MUSIC_CLASSIFICATION + _ORGANIZER_URL_CRITERIA

EXTRACTION_SYSTEM_STRICT = """
あなたはゲーム音楽コンサートの情報を構造化するアシスタントです。
与えられた内容から、以下のJSONスキーマに従って情報を抽出してください。
抽出できない項目はnullにしてください。日時はISO 8601形式（JST）で返してください。
""" + _GAME_TITLES_CRITERIA + _GAME_MUSIC_CLASSIFICATION_STRICT + _ORGANIZER_URL_CRITERIA

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
    "is_game_music_event": "boolean: このイベントがゲーム音楽イベントであるか（迷う場合はtrue）",
    "game_music_reason": "string: 1〜2行の判定理由（例: ゲームタイトル○○の楽曲を演奏 / 作曲家○○はFF・DQで著名 / 一般バンドのライブ）",
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


GAME_TITLES_SYSTEM = """
あなたはゲーム音楽コンサートの情報を判定するアシスタントです。
""" + _GAME_TITLES_CRITERIA + _GAME_MUSIC_CLASSIFICATION

GAME_TITLES_SCHEMA = {
    "game_titles": ["ゲームタイトル名..."],
    "is_game_music_event": "boolean: ゲーム音楽イベントであるか（迷う場合はtrue）",
    "game_music_reason": "string: 1〜2行の判定理由",
}


def extract_game_titles(raw_text: str, source_url: str = "") -> dict:
    """テキストからゲームタイトルとゲーム音楽関連性を抽出する。pre_parsed イベント専用。
    戻り値: {"game_titles": list[str], "is_game_music_event": bool, "game_music_reason": str}
    """
    if not raw_text:
        return {"game_titles": [], "is_game_music_event": True, "game_music_reason": ""}
    prompt = f"""以下のテキストから演奏されるゲームタイトルと、ゲーム音楽イベントとしての関連性を判定してください。

出典URL: {source_url}

テキスト:
{raw_text[:3000]}

以下のJSON形式で返してください:
{json.dumps(GAME_TITLES_SCHEMA, ensure_ascii=False)}

JSONのみ返してください。"""

    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
            system=GAME_TITLES_SYSTEM,
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        parsed = json.loads(text.strip())
        return {
            "game_titles": parsed.get("game_titles", []),
            "is_game_music_event": parsed.get("is_game_music_event", True),
            "game_music_reason": parsed.get("game_music_reason", ""),
        }
    except Exception:
        return {"game_titles": [], "is_game_music_event": True, "game_music_reason": ""}


def _parse_json_response(text: str) -> dict | None:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        parsed = json.loads(text.strip())
        if isinstance(parsed, list):
            return parsed[0] if parsed else None
        return parsed
    except (json.JSONDecodeError, IndexError):
        return None


def extract_event(raw_text: str, source_url: str, strict: bool = False) -> dict | None:
    system = EXTRACTION_SYSTEM_STRICT if strict else EXTRACTION_SYSTEM
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
        system=system,
    )
    return _parse_json_response(resp.content[0].text)


def extract_event_from_image(image_url: str, tweet_text: str, source_url: str) -> dict | None:
    """フライヤー画像をVisionで読み取りイベント情報を抽出する（厳格フィルター適用）。"""
    prompt = f"""このコンサートのフライヤー画像から情報を抽出してください。

ツイートテキスト（補足）:
{tweet_text[:300]}

出典URL: {source_url}

以下のJSONスキーマで返してください:
{json.dumps(EXTRACTION_SCHEMA, ensure_ascii=False, indent=2)}

JSONのみ返してください。"""

    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "url", "url": image_url}},
                    {"type": "text", "text": prompt},
                ],
            }],
            system=EXTRACTION_SYSTEM_STRICT,
        )
        return _parse_json_response(resp.content[0].text)
    except Exception as e:
        print(f"[vision] extraction failed for {image_url[:60]}: {e}")
        return None


_TRANSLATE_SYSTEM = """You are a translator for Japanese game music concert event names.

Rules:
1. Game/brand names: use official English names (e.g., ファイナルファンタジー→Final Fantasy, ゼルダの伝説→The Legend of Zelda, アーケードアーカイブス→Arcade Archives, ドラゴンクエスト→Dragon Quest, ポケモン→Pokémon)
2. Descriptive words: translate naturally (周年記念→Anniversary, コンサート→Concert, ツアー→Tour, 演奏会→Concert, 公演→Performance, 記念イベント→Anniversary Event, 定期演奏会→Regular Concert, 特別公演→Special Performance)
3. Abbreviations/nicknames: romanize (アケアカ→AkeAka, ドラクエ→DraQue)
4. Japanese quotes: 「text」→ "text"
5. If already mostly English, clean up and return as-is
6. Location suffixes like （東京）keep them: (Tokyo)

Return a JSON array of translated strings in the same order as input. Output JSON only."""


def translate_event_names_en(event_names: list[str]) -> list[str | None]:
    """イベント名リストを英語に一括翻訳する（最大20件）。"""
    if not event_names:
        return []
    prompt = f"Translate these Japanese concert event names to English:\n{json.dumps(event_names, ensure_ascii=False)}"
    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
            system=_TRANSLATE_SYSTEM,
        )
        text = resp.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text.strip())
        if isinstance(result, list) and len(result) == len(event_names):
            return [str(r) if r else None for r in result]
    except Exception as e:
        print(f"[translate] error: {e}")
    return [None] * len(event_names)
