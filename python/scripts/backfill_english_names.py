"""
ゲームタイトルの英語名をバックフィルするスクリプト。
既知のメジャータイトルはハードコード、残りは Claude Haiku で補完。
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from utils.db import get_client
import anthropic
from utils.config import ANTHROPIC_API_KEY

# 主要タイトルの公式英語名（手動管理・優先使用）
KNOWN_NAMES: dict[str, str] = {
    "ファイナルファンタジー": "Final Fantasy",
    "ファイナルファンタジーI": "Final Fantasy I",
    "ファイナルファンタジーII": "Final Fantasy II",
    "ファイナルファンタジーIII": "Final Fantasy III",
    "ファイナルファンタジーIV": "Final Fantasy IV",
    "ファイナルファンタジーV": "Final Fantasy V",
    "ファイナルファンタジーVI": "Final Fantasy VI",
    "ファイナルファンタジーVII": "Final Fantasy VII",
    "ファイナルファンタジーVII リメイク": "Final Fantasy VII Remake",
    "ファイナルファンタジーVIII": "Final Fantasy VIII",
    "ファイナルファンタジーIX": "Final Fantasy IX",
    "ファイナルファンタジーX": "Final Fantasy X",
    "ファイナルファンタジーXI": "Final Fantasy XI",
    "ファイナルファンタジーXII": "Final Fantasy XII",
    "ファイナルファンタジーXIII": "Final Fantasy XIII",
    "ファイナルファンタジーXIV": "Final Fantasy XIV",
    "ファイナルファンタジーXV": "Final Fantasy XV",
    "ファイナルファンタジーXVI": "Final Fantasy XVI",
    "ドラゴンクエスト": "Dragon Quest",
    "ドラゴンクエストI": "Dragon Quest I",
    "ドラゴンクエストII": "Dragon Quest II",
    "ドラゴンクエストIII": "Dragon Quest III",
    "ドラゴンクエストIV": "Dragon Quest IV",
    "ドラゴンクエストV": "Dragon Quest V",
    "ドラゴンクエストVI": "Dragon Quest VI",
    "ドラゴンクエストVII": "Dragon Quest VII",
    "ドラゴンクエストVIII": "Dragon Quest VIII",
    "ドラゴンクエストIX": "Dragon Quest IX",
    "ドラゴンクエストX": "Dragon Quest X",
    "ドラゴンクエストXI": "Dragon Quest XI",
    "ゼルダの伝説": "The Legend of Zelda",
    "時のオカリナ": "Ocarina of Time",
    "ゼルダの伝説 時のオカリナ": "The Legend of Zelda: Ocarina of Time",
    "ゼルダの伝説 ブレス オブ ザ ワイルド": "The Legend of Zelda: Breath of the Wild",
    "ゼルダの伝説 ティアーズ オブ ザ キングダム": "The Legend of Zelda: Tears of the Kingdom",
    "ポケットモンスター": "Pokémon",
    "ポケモン": "Pokémon",
    "モンスターハンター": "Monster Hunter",
    "モンスターハンターワールド": "Monster Hunter: World",
    "モンスターハンターライズ": "Monster Hunter Rise",
    "大乱闘スマッシュブラザーズ": "Super Smash Bros.",
    "スーパーマリオ": "Super Mario",
    "マリオカート": "Mario Kart",
    "星のカービィ": "Kirby",
    "メトロイド": "Metroid",
    "ロックマン": "Mega Man",
    "ストリートファイター": "Street Fighter",
    "テイルズ オブ": "Tales of",
    "ペルソナ": "Persona",
    "ペルソナ3": "Persona 3",
    "ペルソナ4": "Persona 4",
    "ペルソナ5": "Persona 5",
    "ソウルキャリバー": "Soulcalibur",
    "鉄拳": "Tekken",
    "バイオハザード": "Resident Evil",
    "デビル メイ クライ": "Devil May Cry",
    "デビルメイクライ": "Devil May Cry",
    "エースコンバット": "Ace Combat",
    "アイドルマスター": "THE IDOLM@STER",
    "アイドルマスター シンデレラガールズ": "THE IDOLM@STER Cinderella Girls",
    "テイルズ オブ ゼスティリア": "Tales of Zestiria",
    "テイルズ オブ ベルセリア": "Tales of Berseria",
    "テイルズ オブ アライズ": "Tales of Arise",
    "ニーア オートマタ": "NieR:Automata",
    "NieR:Automata": "NieR:Automata",
    "ニーア レプリカント": "NieR Replicant",
    "グランブルーファンタジー": "Granblue Fantasy",
    "原神": "Genshin Impact",
    "崩壊：スターレイル": "Honkai: Star Rail",
    "ウマ娘 プリティーダービー": "Uma Musume Pretty Derby",
    "プロジェクトセカイ カラフルステージ！ feat. 初音ミク": "Project SEKAI COLORFUL STAGE! feat. Hatsune Miku",
    "プロジェクトセカイ": "Project SEKAI",
    "MOTHER": "EarthBound / MOTHER",
    "MOTHER2": "EarthBound",
    "MOTHER3": "MOTHER 3",
    "東方Project": "Touhou Project",
    "東方": "Touhou Project",
    "クロノ・トリガー": "Chrono Trigger",
    "聖剣伝説": "Mana series",
    "聖剣伝説2": "Secret of Mana",
    "聖剣伝説3": "Trials of Mana",
    "聖剣伝説 VISIONS of MANA": "Visions of Mana",
    "イース": "Ys",
    "英雄伝説 軌跡シリーズ": "The Legend of Heroes: Trails series",
    "空の軌跡": "Trails in the Sky",
    "碧の軌跡": "Trails to Azure",
    "閃の軌跡": "Trails of Cold Steel",
    "黎の軌跡": "Trails through Daybreak",
    "テイルズ オブ ファンタジア": "Tales of Phantasia",
    "テイルズ オブ デスティニー": "Tales of Destiny",
    "テイルズ オブ イノセンス": "Tales of Innocence",
    "テイルズ オブ グレイセス": "Tales of Graces",
    "テイルズ オブ ハーツ": "Tales of Hearts",
    "テイルズ オブ エクシリア": "Tales of Xillia",
    "ファイアーエムブレム": "Fire Emblem",
    "真・女神転生": "Shin Megami Tensei",
    "デジモン": "Digimon",
    "テトリス": "Tetris",
    "パックマン": "Pac-Man",
    "スペースインベーダー": "Space Invaders",
    "フロントミッション": "Front Mission",
    "ゼノギアス": "Xenogears",
    "ゼノブレイド": "Xenoblade Chronicles",
    "ゼノブレイド2": "Xenoblade Chronicles 2",
    "ゼノブレイド3": "Xenoblade Chronicles 3",
    "桃太郎電鉄": "Momotaro Dentetsu",
    "信長の野望": "Nobunaga's Ambition",
    "三國志": "Romance of the Three Kingdoms",
    "スターオーシャン": "Star Ocean",
    "ヴァルキリープロファイル": "Valkyrie Profile",
    "ロードオブヴァーミリオン": "Lord of Vermilion",
    "キングダムハーツ": "Kingdom Hearts",
    "ソニック": "Sonic the Hedgehog",
    "ソニック・ザ・ヘッジホッグ": "Sonic the Hedgehog",
    "ファンタシースター": "Phantasy Star",
    "ファンタシースターオンライン": "Phantasy Star Online",
    "ファンタシースターオンライン2": "Phantasy Star Online 2",
    "ショベルナイト": "Shovel Knight",
    "Undertale": "Undertale",
    "アンダーテイル": "Undertale",
    "DELTARUNE": "Deltarune",
    "Hollow Knight": "Hollow Knight",
    "ホロウナイト": "Hollow Knight",
    "Celeste": "Celeste",
    "セレスト": "Celeste",
    "Cuphead": "Cuphead",
    "カップヘッド": "Cuphead",
}

CLAUDE_CLIENT = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def ask_claude_english_name(japanese_name: str) -> str | None:
    """Claude Haiku でゲームタイトルの公式英語名を取得する。"""
    prompt = f"""以下は日本のゲームタイトルです。このゲームの公式英語名を返してください。
英語名のみ返してください（説明不要）。公式英語名が不明な場合は「UNKNOWN」と返してください。

ゲームタイトル: {japanese_name}"""

    try:
        resp = CLAUDE_CLIENT.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}],
        )
        result = resp.content[0].text.strip()
        if result == "UNKNOWN" or not result:
            return None
        return result
    except Exception as e:
        print(f"  [claude] error for {japanese_name}: {e}")
        return None


def main():
    db = get_client()

    # english_name が未設定のタイトルを取得
    result = db.table("game_titles").select("id, title_name, english_name").execute()
    titles = result.data or []

    updated = 0
    skipped = 0

    for title in titles:
        if title.get("english_name"):
            skipped += 1
            continue

        name = title["title_name"]

        # まず既知マッピングを確認
        english = KNOWN_NAMES.get(name)

        if not english:
            print(f"  [claude] looking up: {name}")
            english = ask_claude_english_name(name)

        if english:
            db.table("game_titles").update({"english_name": english}).eq("id", title["id"]).execute()
            print(f"  OK: {name} -> {english}")
            updated += 1
        else:
            print(f"  NG: {name} -> (not found)")

    print(f"\n完了: {updated} 件更新, {skipped} 件スキップ（既存あり）")


if __name__ == "__main__":
    main()
