import Image from "next/image";
import Link from "next/link";
import Badge from "./Badge";

type Genre = "orchestra" | "wind" | "rock" | "acoustic" | "chamber" | "other";

interface CardProps {
  imageUrl?: string;
  title: string;
  date: string;
  venue: string;
  organizer?: string;
  genre?: Genre;
  href: string;
}

const genreLabels: Record<Genre, string> = {
  orchestra: "オーケストラ",
  wind:      "吹奏楽",
  rock:      "バンド",
  acoustic:  "アコースティック",
  chamber:   "室内楽",
  other:     "その他",
};

export default function Card({ imageUrl, title, date, venue, organizer, genre, href }: CardProps) {
  return (
    <Link href={href} className="block group">
      <article
        className="bg-parchment rounded-md overflow-hidden transition-all duration-200 ease-in-out group-hover:-translate-y-1 group-hover:shadow-[0_4px_16px_rgba(59,47,29,0.18)]"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        {/* 画像エリア（16:9）：design_system 6-1, 7-2 */}
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
          <p className="font-body text-ink-body text-sm">{date}</p>
          <p className="font-body text-ink-body/70 text-sm truncate">{venue}</p>
          {organizer && (
            <p className="font-body text-ink-body/60 text-sm truncate">{organizer}</p>
          )}
        </div>
      </article>
    </Link>
  );
}
