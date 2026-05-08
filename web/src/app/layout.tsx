import type { Metadata } from "next";
import { Cinzel, EB_Garamond, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-eb-garamond",
  display: "swap",
});

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-serif-jp",
  display: "swap",
  preload: false,
});

const SITE_URL = "https://minstrel.live";
const SITE_NAME = "Minstrel";
const SITE_DESCRIPTION =
  "日本のゲーム音楽コンサート情報を網羅する専門ポータル。公演スケジュール、チケット情報、演奏団体、ゲームタイトル別に検索できます。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Game Music Concert Portal`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Game Music Concert Portal`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - Game Music Concert Portal`,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    google: "MpkAwIPcBhesDvo5IZt4sCEajkdKBYCtbEfuUUEXGJw",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${cinzel.variable} ${ebGaramond.variable} ${notoSerifJP.variable}`}
    >
      <body className="font-body bg-parchment text-ink-body min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-16 md:pt-20">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
