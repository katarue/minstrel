"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import Badge from "./Badge";

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
}

const genreLabels: Record<Genre, string> = {
  orchestra: "オーケストラ",
  wind:      "吹奏楽",
  rock:      "バンド",
  acoustic:  "アコースティック",
  chamber:   "室内楽",
  other:     "その他",
};

export default function Card({ imageUrl, title, titleEn, date, prefecture, venue, organizer, genre, href, gameTitles }: CardProps) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue + (prefecture ? ` ${prefecture}` : ""))}`;

  return (
    <Link href={href} className="block group">
      <article
        className="bg-parchment rounded-md overflow-hidden transition-all duration-200 ease-in-out group-hover:-translate-y-1 group-hover:shadow-[0_4px_16px_rgba(59,47,29,0.18)]"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        {/* 画像エリア（16:9）*/}
        <div className="relative w-full aspect-video bg-parchment-dark">
          {imageUrl ? (
            <Image src={imageUrl} alt={title} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-heading text-gold/40 text-5xl select-none" aria-hidden>
                ♪
              </span>
            </div>
          )}
          {gameTitles && gameTitles.length > 0 && (
            <div className="absolute top-2 left-2">
              <span className="inline-flex items-center gap-1 bg-bordeaux text-white font-body text-xs font-medium px-2 py-0.5 rounded shadow-sm max-w-[10rem]">
                <span className="truncate">{gameTitles[0]}</span>
                {gameTitles.length > 1 && (
                  <span className="opacity-80 shrink-0">+{gameTitles.length - 1}</span>
                )}
              </span>
            </div>
          )}
          {genre && (
            <div className="absolute top-2 right-2">
              <Badge variant={genre}>{genreLabels[genre]}</Badge>
            </div>
          )}
        </div>

        {/* 情報エリア */}
        <div className="p-4 flex flex-col gap-2">
          <h3 className="font-heading text-ink-heading text-base font-semibold leading-snug line-clamp-2">
            {title}
          </h3>
          {titleEn && (
            <p className="font-body text-ink-body/70 text-sm italic leading-snug line-clamp-2 -mt-1">
              {titleEn}
            </p>
          )}

          {/* 日付 + 都道府県 */}
          <div className="flex items-center gap-2">
            <p className="font-body text-ink-body text-sm shrink-0">{date}</p>
            {prefecture && (
              <p className="font-body text-ink-body/60 text-sm truncate">{prefecture}</p>
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
    </Link>
  );
}
