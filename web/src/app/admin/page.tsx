import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";

export const revalidate = 0;

async function getCounts() {
  const supabase = createAdminClient();
  const [reviewRes] = await Promise.all([
    supabase
      .from("event_sources")
      .select("id", { count: "exact", head: true })
      .eq("match_status", "review_needed"),
  ]);
  return { reviewNeeded: reviewRes.count ?? 0 };
}

export default async function AdminPage() {
  const { reviewNeeded } = await getCounts();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-ink-heading text-2xl font-semibold mb-1">
          管理ダッシュボード
        </h1>
        <p className="text-sm text-ink-body/60">Minstrel 収集パイプラインの管理</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="要確認アイテム"
          value={reviewNeeded}
          urgent={reviewNeeded > 0}
        />
      </div>

      <div>
        <h2 className="font-heading text-ink-heading text-base font-semibold mb-3 uppercase tracking-widest text-xs">
          クイックリンク
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NavCard
            href="/admin/review"
            title="レビューキュー"
            description="X スクレイパーが収集したが自動判定できなかったデータを確認・承認・却下する"
            badge={reviewNeeded > 0 ? String(reviewNeeded) : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  urgent,
}: {
  label: string;
  value: number;
  urgent?: boolean;
}) {
  return (
    <div
      className={`bg-parchment rounded-md border px-5 py-4 ${
        urgent ? "border-warning/60" : "border-gold/30"
      }`}
    >
      <p className="text-xs text-ink-body/50 uppercase tracking-wider mb-1">{label}</p>
      <p
        className={`font-heading text-3xl font-bold ${
          urgent ? "text-warning" : "text-ink-heading"
        }`}
      >
        {value}
      </p>
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
