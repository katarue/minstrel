"use client";

import { useState } from "react";
import Link from "next/link";

const navLinks = [
  { label: "コンサート一覧", href: "#" },
  { label: "演奏団体", href: "/organizers" },
  { label: "ゲームタイトル", href: "/titles" },
  { label: "カレンダー", href: "#" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-parchment border-b border-gold/50">
      {/* Main bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-20 h-16 md:h-20 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-heading text-bordeaux text-xl md:text-2xl font-bold tracking-widest hover:text-bordeaux/80 transition-colors"
        >
          MINSTREL
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8" aria-label="メインナビゲーション">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-body text-ink-body hover:text-bordeaux transition-colors text-sm tracking-wide"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Hamburger (mobile) */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2 -mr-2"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
          aria-expanded={menuOpen}
        >
          <span
            className={`block w-6 h-0.5 bg-ink-heading transition-transform duration-200 origin-center ${
              menuOpen ? "rotate-45 translate-y-2" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-ink-heading transition-opacity duration-200 ${
              menuOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-ink-heading transition-transform duration-200 origin-center ${
              menuOpen ? "-rotate-45 -translate-y-2" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav
          className="md:hidden bg-parchment border-t border-gold/30 px-4 py-4 flex flex-col gap-4"
          aria-label="モバイルナビゲーション"
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
        </nav>
      )}
    </header>
  );
}
