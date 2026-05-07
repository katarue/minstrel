import Card from "@/components/ui/Card";

/* 仮データ：1-C でSupabaseの実データに差し替え */
const sampleConcerts = [
  {
    id: "1",
    title: "ファイナルファンタジーオーケストラコンサート 2026",
    date: "2026年6月15日（日）",
    venue: "サントリーホール（東京）",
    genre: "orchestra" as const,
    href: "#",
  },
  {
    id: "2",
    title: "植松伸夫 presents クリスタルフォーチュン in Tokyo",
    date: "2026年7月20日（日）",
    venue: "東京国際フォーラム ホールA",
    genre: "orchestra" as const,
    href: "#",
  },
  {
    id: "3",
    title: "ゼルダの伝説 吹奏楽フェスタ",
    date: "2026年8月3日（土）",
    venue: "大阪フェスティバルホール",
    genre: "wind" as const,
    href: "#",
  },
  {
    id: "4",
    title: "ペルソナ ライブバンド コンサート",
    date: "2026年8月22日（金）",
    venue: "Zepp Tokyo",
    genre: "rock" as const,
    href: "#",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* ── ヒーローセクション ── */}
      <section className="bg-parchment py-24 px-4 text-center border-b border-gold/30">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          <h1 className="font-heading text-bordeaux text-5xl md:text-7xl font-bold tracking-widest leading-tight">
            MINSTREL
          </h1>
          <p className="font-body text-ink-body text-lg md:text-xl tracking-wide">
            Game Music Concert Portal
          </p>
          <div className="w-24 h-px bg-gold" aria-hidden />
          <p className="font-body text-ink-body/80 text-base md:text-lg max-w-xl leading-relaxed">
            日本のゲーム音楽コンサート情報を集約する専門ポータル
          </p>
        </div>
      </section>

      {/* ── セクション区切り装飾（design_system 9-2）── */}
      <div
        className="flex items-center justify-center py-8 text-gold text-2xl select-none"
        aria-hidden
      >
        ♩
      </div>

      {/* ── 最新のコンサートセクション ── */}
      <section className="max-w-7xl mx-auto px-4 lg:px-20 pb-20">
        <h2 className="font-heading text-ink-heading text-2xl md:text-3xl font-semibold mb-8">
          最新のコンサート
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {sampleConcerts.map((concert) => (
            <Card
              key={concert.id}
              title={concert.title}
              date={concert.date}
              venue={concert.venue}
              genre={concert.genre}
              href={concert.href}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
