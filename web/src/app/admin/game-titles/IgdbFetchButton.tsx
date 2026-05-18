"use client";

import { useState, useTransition } from "react";
import { fetchIgdbCovers } from "./actions";

export function IgdbFetchButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await fetchIgdbCovers();
      if (!res.ok) {
        setResult(`エラー: ${res.message}`);
      } else if (res.updated === 0) {
        setResult("更新対象なし（全件設定済み）");
      } else {
        setResult(`${res.updated} 件取得完了（見つからず ${res.skipped} 件）`);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={pending}
        className="text-xs border border-gold/40 bg-parchment hover:bg-parchment-dark px-3 py-1.5 rounded transition-colors disabled:opacity-50"
      >
        {pending ? "IGDB取得中…" : "IGDB画像を一括取得"}
      </button>
      {result && <span className="text-xs text-ink-body/60">{result}</span>}
    </div>
  );
}
