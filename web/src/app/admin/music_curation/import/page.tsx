import Link from "next/link";

export default function MusicCurationImportPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/admin/music_curation"
            className="text-xs text-ink-body/40 hover:text-bordeaux transition-colors"
          >
            ← 楽曲キュレーション
          </Link>
        </div>
        <h1 className="font-heading text-ink-heading text-2xl font-semibold">楽曲インポート</h1>
        <p className="text-sm text-ink-body/60 mt-0.5">Spotify / CSV から楽曲データを一括登録する</p>
      </div>

      <div className="bg-parchment rounded-md border border-gold/30 px-6 py-8 text-center">
        <p className="text-ink-body/50 text-sm">スプリント2で実装予定</p>
        <p className="text-ink-body/30 text-xs mt-1">Spotify Artist ID から楽曲情報を自動取得し、スコア計算して登録します</p>
      </div>
    </div>
  );
}
