"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import Badge from "./Badge";
import { prefectureToRegion, REGION_COLORS } from "@/utils/regions";

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";

interface CardProps {
  imageUrl?: string;
  title: string;
  titleEn?: string;
  date: string;
  prefecture?: string;
  venue: string;
  organizer?: string;
  genre?: Genre;
  href: string;
  gameTitles?: string[];
  tourCount?: number;
  isPast?: boolean;
}

const genreLabels: Record<Genre, string> = {
  orchestra: "オーケストラ",
  wind:      "吹奏楽",
  rock:      "バンド",
  acoustic:  "アコースティック",
  chamber:   "室内楽",
  other:     "その他",
};

export default function Card({ imageUrl, title, titleEn, date, prefecture, venue, organizer, genre, href, gameTitles, tourCount, isPast }: CardProps) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue + (prefecture ? ` ${prefecture}` : ""))}`;
  const region = prefectureToRegion(prefecture);

  return (
    <Link href={href} className="block group relative">
      <article
        className="bg-parchment rounded-md overflow-hidden transition-all duration-200 ease-in-out group-hover:-translate-y-1 group-hover:shadow-[0_4px_16px_rgba(59,47,29,0.18)]"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        {/* 画像エリア（16:9）*/}
        <div className="relative w-full aspect-video bg-parchment-dark">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              className={`object-cover${isPast ? " grayscale opacity-70" : ""}`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-heading text-gold/40 text-5xl select-none" aria-hidden>
                ♪
              </span>
            </div>
          )}
          {genre && (
            <div className="absolute top-2 right-2">
              <Badge variant={genre}>{genreLabels[genre]}</Badge>
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
        <div className="p-4 flex flex-col gap-2">
          {gameTitles && gameTitles.length > 0 && (
            <span className="inline-flex items-center gap-1 self-start bg-bordeaux text-white font-body text-xs font-medium px-2 py-0.5 rounded max-w-full">
              <span className="truncate">{gameTitles[0]}</span>
              {gameTitles.length > 1 && (
                <span className="opacity-80 shrink-0">+{gameTitles.length - 1}</span>
              )}
            </span>
          )}
          <h3 className="font-heading text-ink-heading text-base font-semibold leading-snug line-clamp-2">
            {title}
          </h3>
          {titleEn && (
            <p className="font-body text-ink-body/70 text-sm italic leading-snug line-clamp-2 -mt-1">
              {titleEn}
            </p>
          )}

          {/* 日付 + 都道府県 + ツアーバッジ */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-body text-ink-body text-sm shrink-0">{date}</p>
            {prefecture && (
              <p className="font-body text-ink-body/60 text-sm truncate">{prefecture}</p>
            )}
            {tourCount && tourCount > 1 && (
              <span className="shrink-0 font-body text-xs text-bordeaux border border-bordeaux/40 rounded px-1.5 py-0.5 leading-none">
                全{tourCount}公演
              </span>
            )}
          </div>

          {/* 会場名 + マップアイコン */}
          <div className="flex items-center gap-1.5 min-w-0">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-ink-body/40 hover:text-bordeaux transition-colors"
              aria-label="Google マップで見る"
            >
              <MapPin size={13} strokeWidth={1.8} />
            </a>
            <p className="font-body text-ink-body/70 text-sm truncate">{venue}</p>
          </div>

          {organizer && (
            <p className="font-body text-ink-body/60 text-sm truncate">{organizer}</p>
          )}
        </div>
      </article>

      {/* 地域バッジ：cardの枠をはみ出してポストイット風に表示 */}
      {region && (
        <div className="absolute -top-3 right-3 z-10">
          <span
            className="inline-block font-body text-xs font-semibold px-2.5 py-1 rounded shadow-md whitespace-nowrap text-white"
            style={{ backgroundColor: REGION_COLORS[region] }}
          >
            {region}
          </span>
        </div>
      )}
    </Link>
  );
}
