"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Globe } from "lucide-react";

export default function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { label: t("calendar"), href: "/calendar" },
    { label: t("concerts"), href: "/concerts" },
    { label: t("titles"), href: "/titles" },
  ];

  const otherLocale = locale === "ja" ? "en" : "ja";
  const langLabel = locale === "ja" ? "English" : "日本語";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-parchment border-b border-gold/50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 h-16 md:h-20 flex items-center justify-between">
        <Link
          href="/"
          className="font-heading text-bordeaux text-xl md:text-2xl font-bold tracking-widest hover:text-bordeaux/80 transition-colors"
        >
          MINSTREL
        </Link>

        <nav className="hidden md:flex items-center gap-8" aria-label={t("main")}>
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-body text-ink-body hover:text-bordeaux transition-colors text-sm tracking-wide"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/submit"
            className="font-body text-sm bg-bordeaux text-parchment hover:bg-bordeaux/80 transition-colors rounded px-3 py-1.5 tracking-wide"
          >
            {t("submit")}
          </Link>
          <Link
            href={pathname}
            locale={otherLocale}
            className="inline-flex items-center gap-1.5 font-body text-ink-body/60 hover:text-bordeaux transition-colors text-xs tracking-wider border border-gold/40 rounded px-2.5 py-1"
          >
            <Globe size={12} strokeWidth={1.6} />
            {langLabel}
          </Link>
        </nav>

        <button
          className="md:hidden flex flex-col gap-1.5 p-2 -mr-2"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? t("menuClose") : t("menuOpen")}
          aria-expanded={menuOpen}
        >
          <span className={`block w-6 h-0.5 bg-ink-heading transition-transform duration-200 origin-center ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-6 h-0.5 bg-ink-heading transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block w-6 h-0.5 bg-ink-heading transition-transform duration-200 origin-center ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {menuOpen && (
        <nav
          className="md:hidden bg-parchment border-t border-gold/30 px-4 py-4 flex flex-col gap-4"
          aria-label={t("mobile")}
        >
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-body text-ink-body hover:text-bordeaux transition-colors py-1"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/submit"
            className="font-body text-sm bg-bordeaux text-parchment hover:bg-bordeaux/80 transition-colors rounded px-3 py-2 self-start"
            onClick={() => setMenuOpen(false)}
          >
            {t("submit")}
          </Link>
          <Link
            href={pathname}
            locale={otherLocale}
            className="font-body text-ink-body/60 hover:text-bordeaux transition-colors text-xs tracking-wider border border-gold/40 rounded px-2 py-1 self-start"
            onClick={() => setMenuOpen(false)}
          >
            {langLabel}
          </Link>
        </nav>
      )}
    </header>
  );
}
