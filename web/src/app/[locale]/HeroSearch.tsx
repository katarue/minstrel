"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

export default function HeroSearch() {
  const [q, setQ] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/concerts?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg gap-2"
    >
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="コンサート名・ゲームタイトルで検索..."
        className="flex-1 px-4 py-3 text-sm font-body bg-parchment border border-gold/50 rounded focus:outline-none focus:border-bordeaux text-ink-body placeholder:text-ink-body/40 transition-colors"
      />
      <button
        type="submit"
        className="shrink-0 px-5 py-3 text-sm font-body bg-bordeaux text-parchment rounded hover:bg-bordeaux/80 transition-colors"
      >
        検索
      </button>
    </form>
  );
}
