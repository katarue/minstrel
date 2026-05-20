"""シードアーティストリスト。
Spotify 上で検索する際の起点となるアーティスト名を定義する。
"""

# (name, hint) — hint は検索精度向上のためのジャンル・楽器キーワード（任意）
SEED_ARTISTS: list[tuple[str, str]] = [
    # 海外アーティスト
    ("Samantha Ballard",         "video game piano"),
    ("Israfelcello",              "video game cello"),
    ("Purpleschala",              "video game piano"),
    ("Harpsibored",               "video game harpsichord"),
    ("Shea's Violin",             "video game violin"),
    ("John Oeth",                 "video game piano"),
    ("mauricemori",               "video game piano"),
    ("Super Piano 64",            "video game piano"),
    ("Taylor Davis",              "video game violin"),
    ("insaneintherainmusic",      "video game jazz"),
    ("Delldongo",                 "video game piano"),
    ("Brooke Ferd",               "video game cover"),
    ("Super Guitar Bros",         "video game guitar"),
    # 国内アーティスト・作曲家
    ("植松伸夫",                   ""),
    ("光田康典",                   ""),
    ("伊藤賢治",                   ""),
    ("西木康智",                   ""),
    ("崎元仁",                    ""),
    ("菊田裕樹",                   ""),
    ("SQUARE ENIX MUSIC",         ""),
    ("アトラスサウンドチーム",        ""),
]
