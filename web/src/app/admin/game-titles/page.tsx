import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { GameTitleList, type GameTitle } from "./GameTitleList";

export const revalidate = 0;

async function getGameTitles(): Promise<GameTitle[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("game_titles")
    .select("id, title_name, english_name, series_name, publisher, igdb_cover_url, key_visual_url, amazon_asin, amazon_image_url, amazon_affiliate_url")
    .order("title_name", { ascending: true });

  if (error) {
    console.error("[admin/game-titles]", error);
    return [];
  }
  return (data ?? []) as GameTitle[];
}

export default async function GameTitlesPage() {
  const titles = await getGameTitles();
  const withCover = titles.filter((t) => t.igdb_cover_url || t.key_visual_url).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin"
              className="text-xs text-ink-body/40 hover:text-bordeaux transition-colors"
            >
              ← ダッシュボード
            </Link>
          </div>
          <h1 className="font-heading text-ink-heading text-2xl font-semibold">
            ゲームタイトル管理
          </h1>
          <p className="text-sm text-ink-body/60 mt-0.5">
            ビジュアル・メタ情報の確認・編集
          </p>
        </div>
        <span className="shrink-0 text-xs text-ink-body/40 mt-2">
          全 {titles.length} 件（画像あり {withCover} 件）
        </span>
      </div>

      <GameTitleList titles={titles} />
    </div>
  );
}
