"use client";

import { Link } from "@/i18n/navigation";

type Tab = "concerts" | "broadcasts";

export default function ConcertsTabs({
  active,
  concertsLabel,
  broadcastsLabel,
}: {
  active: Tab;
  concertsLabel: string;
  broadcastsLabel: string;
}) {
  return (
    <div className="flex gap-0 border-b border-gold/30 mb-8">
      <Link
        href="/concerts"
        className={`font-body text-sm px-5 py-2.5 border-b-2 transition-colors ${
          active === "concerts"
            ? "border-bordeaux text-bordeaux font-semibold"
            : "border-transparent text-ink-body/60 hover:text-ink-body"
        }`}
      >
        🎵 {concertsLabel}
      </Link>
      <Link
        href="/concerts?tab=broadcasts"
        className={`font-body text-sm px-5 py-2.5 border-b-2 transition-colors ${
          active === "broadcasts"
            ? "border-bordeaux text-bordeaux font-semibold"
            : "border-transparent text-ink-body/60 hover:text-ink-body"
        }`}
      >
        📺 {broadcastsLabel}
      </Link>
    </div>
  );
}
