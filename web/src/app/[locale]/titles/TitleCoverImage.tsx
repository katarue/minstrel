"use client";

import { useState } from "react";

export function TitleCoverImage({
  asin,
  keyVisualUrl,
  igdbUrl,
  alt,
}: {
  asin: string | null;
  keyVisualUrl: string | null;
  igdbUrl: string | null;
  alt: string;
}) {
  const primary = asin
    ? `/api/amazon-image?asin=${asin}`
    : (keyVisualUrl ?? igdbUrl ?? null);

  const [src, setSrc] = useState<string | null>(primary);
  const [triedCount, setTriedCount] = useState(0);

  const fallbacks = (asin ? [keyVisualUrl, igdbUrl] : [igdbUrl]).filter(
    (u): u is string => !!u
  );

  const handleError = () => {
    const next = fallbacks[triedCount];
    if (next) {
      setSrc(next);
      setTriedCount((c) => c + 1);
    } else {
      setSrc(null);
    }
  };

  if (!src) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-parchment-dark">
        <span className="font-heading text-ink-heading/25 text-3xl font-bold text-center leading-tight px-2">
          {alt.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="absolute inset-0 w-full h-full object-cover"
      onError={handleError}
    />
  );
}
