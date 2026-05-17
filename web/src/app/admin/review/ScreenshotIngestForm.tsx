"use client";

import { useState, useRef, useCallback } from "react";
import { ingestFromScreenshot } from "./research-actions";

type ImageData = { base64: string; mediaType: string; previewUrl: string };

function compressToJpeg(blob: Blob): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => {
      const maxW = 1920;
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas error")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg", previewUrl: dataUrl });
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

export function ScreenshotIngestForm() {
  const [image, setImage] = useState<ImageData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const areaRef = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    const blob = imageItem.getAsFile();
    if (!blob) return;
    e.preventDefault();
    try {
      const compressed = await compressToJpeg(blob);
      setImage(compressed);
      setStatus("idle");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("画像の読み込みに失敗しました");
    }
  }, []);

  const handleAnalyze = async () => {
    if (!image) return;
    setStatus("loading");
    setMessage("");
    const result = await ingestFromScreenshot(image.base64, image.mediaType);
    setStatus(result.ok ? "ok" : "error");
    setMessage(result.message);
    if (result.ok) setImage(null);
  };

  const handleClear = () => {
    setImage(null);
    setStatus("idle");
    setMessage("");
  };

  return (
    <div className="bg-parchment rounded-md border border-gold/30 px-5 py-3">
      <p className="text-xs font-semibold text-ink-heading uppercase tracking-widest mb-2">
        スクリーンショットから取得
      </p>

      {!image ? (
        <div
          ref={areaRef}
          tabIndex={0}
          onPaste={handlePaste}
          className="flex items-center justify-center h-20 rounded border-2 border-dashed border-gold/40 bg-white/40 text-xs text-ink-body/40 cursor-text focus:outline-none focus:border-bordeaux/40 focus:bg-white/60 transition-colors"
        >
          ここをクリックして Ctrl+V でスクリーンショットを貼り付け
        </div>
      ) : (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt="貼り付け画像"
            className="max-h-48 rounded border border-gold/30 object-contain"
          />
          <div className="flex gap-2 items-center">
            <button
              onClick={handleAnalyze}
              disabled={status === "loading"}
              className="text-sm px-4 py-1.5 rounded bg-bordeaux text-parchment font-semibold hover:bg-bordeaux/80 disabled:opacity-40 transition-colors"
            >
              {status === "loading" ? "分析中…" : "分析して登録"}
            </button>
            <button
              onClick={handleClear}
              disabled={status === "loading"}
              className="text-sm px-3 py-1.5 rounded border border-gold/40 text-ink-body/50 hover:bg-gold/10 disabled:opacity-40 transition-colors"
            >
              クリア
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-xs mt-1.5 ${status === "ok" ? "text-green-700" : "text-red-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
