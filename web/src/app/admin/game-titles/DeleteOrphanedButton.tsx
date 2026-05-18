"use client";

import { useState, useTransition } from "react";
import { deleteOrphanedGameTitles } from "./actions";

export function DeleteOrphanedButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("イベント紐付けが0件のゲームタイトルをすべて削除しますか？")) return;
    setResult(null);
    startTransition(async () => {
      const res = await deleteOrphanedGameTitles();
      if (!res.ok) {
        setResult(`エラー: ${res.message}`);
      } else if (res.deleted === 0) {
        setResult("削除対象なし");
      } else {
        setResult(`${res.deleted} 件削除しました`);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={pending}
        className="text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
      >
        {pending ? "削除中…" : "0件タイトルを一括削除"}
      </button>
      {result && <span className="text-xs text-ink-body/60">{result}</span>}
    </div>
  );
}
