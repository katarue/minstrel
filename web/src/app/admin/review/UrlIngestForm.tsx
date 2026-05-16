"use client";

import { useState } from "react";
import { ingestFromUrl } from "./research-actions";

export function UrlIngestForm() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setStatus("loading");
    setMessage("");
    const result = await ingestFromUrl(url.trim());
    setStatus(result.ok ? "ok" : "error");
    setMessage(result.message);
    if (result.ok) setUrl("");
  }

  return (
    <div className="bg-parchment rounded-md border border-gold/30 px-5 py-3">
      <p className="text-xs font-semibold text-ink-heading uppercase tracking-widest mb-2">
        URLから取得
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 text-sm px-3 py-1.5 rounded border border-gold/40 bg-white focus:outline-none focus:border-bordeaux/50 placeholder:text-ink-body/30"
          disabled={status === "loading"}
        />
        <button
          type="submit"
          disabled={status === "loading" || !url.trim()}
          className="text-sm px-4 py-1.5 rounded bg-bordeaux text-parchment font-semibold hover:bg-bordeaux/80 disabled:opacity-40 transition-colors"
        >
          {status === "loading" ? "取得中…" : "取得"}
        </button>
      </form>
      {message && (
        <p className={`text-xs mt-1.5 ${status === "ok" ? "text-green-700" : "text-red-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
