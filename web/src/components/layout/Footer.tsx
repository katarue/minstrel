import Link from "next/link";

const footerLinks = [
  { label: "掲載基準", href: "/policy" },
  { label: "プライバシーポリシー", href: "/privacy" },
  { label: "利用規約", href: "/terms" },
  { label: "お問い合わせ", href: "/contact" },
];

export default function Footer() {
  return (
    <footer className="bg-parchment-dark border-t border-gold/50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 py-10 flex flex-col items-center gap-6">
        {/* Logo */}
        <Link
          href="/"
          className="font-heading text-bordeaux text-lg font-bold tracking-widest hover:text-bordeaux/80 transition-colors"
        >
          MINSTREL
        </Link>
        <p className="font-body text-ink-body/70 text-sm tracking-wide">
          Game Music Concert Portal
        </p>

        {/* Divider */}
        <div className="w-16 h-px bg-gold/50" />

        {/* Nav */}
        <nav
          className="flex flex-wrap justify-center gap-6"
          aria-label="フッターナビゲーション"
        >
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-body text-ink-body/70 hover:text-bordeaux transition-colors text-sm"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Disclaimer */}
        <p className="font-body text-ink-body/50 text-xs text-center max-w-lg">
          掲載情報は公式サイト等をもとに作成していますが、正確性を保証するものではありません。
          最新情報は必ず公式情報をご確認ください。
        </p>

        {/* Copyright */}
        <p className="font-body text-ink-body/50 text-xs text-center">
          © 2026 Minstrel - Game Music Concert Portal
        </p>
      </div>
    </footer>
  );
}
