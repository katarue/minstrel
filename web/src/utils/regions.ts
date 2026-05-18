export const REGIONS = [
  "北海道",
  "東北",
  "関東",
  "中部",
  "関西",
  "中国・四国",
  "九州・沖縄",
] as const;

export type Region = (typeof REGIONS)[number];

export const REGION_PREFECTURES: Record<Region, string[]> = {
  北海道: ["北海道"],
  東北: ["青森", "岩手", "宮城", "秋田", "山形", "福島"],
  関東: ["茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川"],
  中部: ["新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "静岡", "愛知"],
  関西: ["三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山"],
  "中国・四国": ["鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知"],
  "九州・沖縄": ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"],
};

export const REGION_COLORS: Record<Region, string> = {
  北海道:       "#2C5F7A",
  東北:         "#3D6642",
  関東:         "#5A3572",
  中部:         "#7A5C2E",
  関西:         "#2E6460",
  "中国・四国": "#5C7A35",
  "九州・沖縄": "#7A3D55",
};

export const REGION_EN: Record<Region, string> = {
  北海道: "Hokkaido",
  東北: "Tohoku",
  関東: "Kanto",
  中部: "Chubu",
  関西: "Kansai",
  "中国・四国": "Chugoku/Shikoku",
  "九州・沖縄": "Kyushu/Okinawa",
};

export const PREFECTURE_EN: Record<string, string> = {
  北海道: "Hokkaido", 青森県: "Aomori", 岩手県: "Iwate", 宮城県: "Miyagi",
  秋田県: "Akita", 山形県: "Yamagata", 福島県: "Fukushima",
  茨城県: "Ibaraki", 栃木県: "Tochigi", 群馬県: "Gunma",
  埼玉県: "Saitama", 千葉県: "Chiba", 東京都: "Tokyo", 神奈川県: "Kanagawa",
  新潟県: "Niigata", 富山県: "Toyama", 石川県: "Ishikawa", 福井県: "Fukui",
  山梨県: "Yamanashi", 長野県: "Nagano", 岐阜県: "Gifu",
  静岡県: "Shizuoka", 愛知県: "Aichi",
  三重県: "Mie", 滋賀県: "Shiga", 京都府: "Kyoto", 大阪府: "Osaka",
  兵庫県: "Hyogo", 奈良県: "Nara", 和歌山県: "Wakayama",
  鳥取県: "Tottori", 島根県: "Shimane", 岡山県: "Okayama",
  広島県: "Hiroshima", 山口県: "Yamaguchi",
  徳島県: "Tokushima", 香川県: "Kagawa", 愛媛県: "Ehime", 高知県: "Kochi",
  福岡県: "Fukuoka", 佐賀県: "Saga", 長崎県: "Nagasaki",
  熊本県: "Kumamoto", 大分県: "Oita", 宮崎県: "Miyazaki",
  鹿児島県: "Kagoshima", 沖縄県: "Okinawa",
};

export function prefectureEn(prefecture: string | null | undefined): string | null {
  if (!prefecture) return null;
  return PREFECTURE_EN[prefecture] ?? null;
}

export function prefectureToRegion(prefecture: string | null | undefined): Region | null {
  if (!prefecture) return null;
  for (const [region, keywords] of Object.entries(REGION_PREFECTURES) as [Region, string[]][]) {
    if (keywords.some((k) => prefecture.includes(k))) return region;
  }
  return null;
}
