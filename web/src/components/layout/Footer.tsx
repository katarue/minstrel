import Link from "next/link";

const footerLinks = [
  { label: "プライバシーポリシー", href: "#" },
  { label: "利用規約", href: "#" },
  { label: "お問い合わせ", href: "#" },
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

        {/* Copyright */}
        <p className="font-body text-ink-body/50 text-xs text-center">
          © 2026 Minstrel - Game Music Concert Portal
        </p>
      </div>
    </footer>
  );
}
