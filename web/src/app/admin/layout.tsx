import type { ReactNode } from "react";

export const metadata = { title: "管理ダッシュボード – Minstrel" };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-parchment-dark min-h-screen font-body text-ink-body">
        <header className="bg-parchment border-b border-gold/30 px-6 py-3 flex items-center gap-4">
          <a
            href="https://minstrel.live"
            className="font-heading text-bordeaux text-lg font-bold tracking-widest hover:opacity-70 transition-opacity"
          >
            Minstrel
          </a>
          <span className="text-gold/60 text-sm">|</span>
          <span className="text-sm text-ink-body/60">管理ダッシュボード</span>
        </header>
        <main className="w-[90vw] max-w-[1600px] mx-auto px-4 md:px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
