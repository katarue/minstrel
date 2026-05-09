import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Footer() {
  const t = useTranslations("footer");

  const footerLinks = [
    { key: "policy", href: "/policy" },
    { key: "privacy", href: "/privacy" },
    { key: "terms", href: "/terms" },
    { key: "contact", href: "/contact" },
  ] as const;

  return (
    <footer className="bg-parchment-dark border-t border-gold/50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 py-10 flex flex-col items-center gap-6">
        <Link
          href="/"
          className="font-heading text-bordeaux text-lg font-bold tracking-widest hover:text-bordeaux/80 transition-colors"
        >
          MINSTREL
        </Link>
        <p className="font-body text-ink-body/70 text-sm tracking-wide">
          {t("tagline")}
        </p>

        <div className="w-16 h-px bg-gold/50" />

        <nav className="flex flex-wrap justify-center gap-6" aria-label={t("footerNav")}>
          {footerLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className="font-body text-ink-body/70 hover:text-bordeaux transition-colors text-sm"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <p className="font-body text-ink-body/50 text-xs text-center max-w-lg">
          {t("disclaimer")}
        </p>
        <p className="font-body text-ink-body/50 text-xs text-center">
          {t("copyright")}
        </p>
      </div>
    </footer>
  );
}
