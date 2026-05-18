import Link from "next/link";

export const revalidate = 0;

export default async function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-ink-heading text-2xl font-semibold mb-1">
          管理ダッシュボード
        </h1>
        <p className="text-sm text-ink-body/60">Minstrel 収集パイプラインの管理</p>
      </div>

      <div>
        <h2 className="font-heading text-ink-heading text-base font-semibold mb-3 uppercase tracking-widest text-xs">
          クイックリンク
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NavCard
            href="/admin/review"
            title="イベント管理"
            description="収集済みイベントの公開・非公開を管理する"
          />
          <NavCard
            href="/admin/game-titles"
            title="ゲームタイトル管理"
            description="ゲームタイトルのビジュアル・メタ情報を管理する"
          />
        </div>
      </div>
    </div>
  );
}

function NavCard({
  href,
  title,
  description,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-parchment rounded-md border border-gold/30 px-5 py-4 hover:border-bordeaux/50 hover:shadow-[0_2px_8px_rgba(114,47,55,0.08)] transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-heading text-ink-heading text-base font-semibold group-hover:text-bordeaux transition-colors">
          {title}
        </span>
        {badge && (
          <span className="inline-block bg-warning/20 text-warning text-xs font-bold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-ink-body/60 mt-1 leading-relaxed">{description}</p>
    </Link>
  );
}
