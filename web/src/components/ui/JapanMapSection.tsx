import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { REGIONS } from "@/utils/regions";
import type { Region } from "@/utils/regions";

// 地図画像上の各地域ボタンの位置（画像全体に対するパーセンテージ）
const REGION_POSITIONS: Record<Region, { top: string; left: string }> = {
  北海道:       { top: "22%", left: "75%" },
  東北:         { top: "42%", left: "67%" },
  関東:         { top: "59%", left: "62%" },
  中部:         { top: "61%", left: "52%" },
  関西:         { top: "64%", left: "41%" },
  "中国・四国": { top: "68%", left: "27%" },
  "九州・沖縄": { top: "77%", left: "14%" },
};

interface Props {
  regionCounts: Map<Region, number>;
}

export default function JapanMapSection({ regionCounts }: Props) {
  return (
    <>
      {/* 地図（md以上） */}
      <div className="hidden md:block relative w-full max-w-3xl mx-auto select-none">
        <Image
          src="/images/japan-map.png"
          alt="日本地図"
          width={500}
          height={625}
          className="w-full h-auto"
          priority={false}
        />

        {REGIONS.map((region) => {
          const count = regionCounts.get(region) ?? 0;
          const pos = REGION_POSITIONS[region];
          return (
            <Link
              key={region}
              href={count > 0 ? `/concerts?region=${encodeURIComponent(region)}` : "#"}
              style={{ top: pos.top, left: pos.left }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-10
                bg-parchment/90 backdrop-blur-sm border rounded-lg shadow-md
                px-3 py-2 text-center whitespace-nowrap transition-all duration-150
                ${count > 0
                  ? "border-gold/70 hover:border-bordeaux hover:shadow-lg hover:-translate-y-[calc(50%+2px)] cursor-pointer"
                  : "border-gold/30 opacity-50 pointer-events-none"
                }`}
            >
              <p className={`font-heading text-base font-semibold leading-tight ${count > 0 ? "text-ink-heading" : "text-ink-body/40"}`}>
                {region}
              </p>
              <p className={`mt-0.5 ${count > 0 ? "text-bordeaux" : "text-ink-body/30"}`}>
                <span className="font-sans text-2xl font-bold tabular-nums">{count}</span>
                <span className="font-body text-base font-medium">件</span>
              </p>
            </Link>
          );
        })}
      </div>

      {/* グリッドフォールバック（sm以下） */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:hidden">
        {REGIONS.map((region) => {
          const count = regionCounts.get(region) ?? 0;
          return (
            <Link
              key={region}
              href={`/concerts?region=${encodeURIComponent(region)}`}
              className={`flex flex-col items-center justify-center px-3 py-5 border rounded-lg text-center transition-colors ${
                count > 0
                  ? "border-gold/40 hover:border-bordeaux hover:text-bordeaux"
                  : "border-gold/20 pointer-events-none"
              }`}
            >
              <span className={`font-body text-sm ${count > 0 ? "text-ink-body" : "text-ink-body/40"}`}>
                {region}
              </span>
              <span className={`font-heading text-2xl font-bold mt-1 ${count > 0 ? "text-bordeaux" : "text-ink-body/25"}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
