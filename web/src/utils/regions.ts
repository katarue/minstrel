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

export function prefectureToRegion(prefecture: string | null | undefined): Region | null {
  if (!prefecture) return null;
  for (const [region, keywords] of Object.entries(REGION_PREFECTURES) as [Region, string[]][]) {
    if (keywords.some((k) => prefecture.includes(k))) return region;
  }
  return null;
}
