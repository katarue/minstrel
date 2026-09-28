"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

interface PosterCardProps {
  imageUrl?: string;
  title: string;
  titleEn?: string;
  date: string;
  href: string;
  isPast?: boolean;
}

export default function PosterCard({ imageUrl, title, titleEn, date, href, isPast }: PosterCardProps) {
  const router = useRouter();

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => e.key === "Enter" && router.push(href)}
      className="group cursor-pointer shrink-0 w-[72vw] max-w-[300px] snap-center md:w-full md:max-w-none md:shrink"
    >
      <article
        className="bg-parchment rounded-md overflow-hidden transition-all duration-200 ease-in-out group-hover:-translate-y-1 group-hover:shadow-[0_4px_16px_rgba(59,47,29,0.18)]"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        {/* 画像エリア（縦長チラシ全体を表示、切り取らない） */}
        <div className="relative w-full aspect-[210/297] bg-parchment-dark">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              sizes="(max-width: 768px) 72vw, 33vw"
              className={`object-contain${isPast ? " grayscale opacity-70" : ""}`}
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-heading text-gold/40 text-6xl select-none" aria-hidden>
                ♪
              </span>
            </div>
          )}
          {isPast && (
            <div className="absolute bottom-2 right-2">
              <span className="font-body text-xs font-medium px-2 py-0.5 rounded bg-black/50 text-white/80">
                終了
              </span>
            </div>
          )}
        </div>

        {/* 情報エリア */}
        <div className="p-4 flex flex-col gap-1">
          <p className="font-body text-ink-body text-sm">{date}</p>
          <h3 className="font-heading text-ink-heading text-base font-semibold leading-snug line-clamp-2">
            {title}
          </h3>
          {titleEn && (
            <p className="font-body text-ink-body/80 text-sm italic leading-snug line-clamp-1">
              {titleEn}
            </p>
          )}
        </div>
      </article>
    </div>
  );
}
