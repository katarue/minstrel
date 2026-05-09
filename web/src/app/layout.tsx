import type { Metadata } from "next";
import { Cinzel, EB_Garamond, Noto_Serif_JP } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - Game Music Concert Portal`,
    template: `%s | ${SITE_NAME}`,
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "ja": SITE_URL,
      "en": `${SITE_URL}/en`,
    },
  },
  verification: {
    google: "MpkAwIPcBhesDvo5IZt4sCEajkdKBYCtbEfuUUEXGJw",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${cinzel.variable} ${ebGaramond.variable} ${notoSerifJP.variable}`}
    >
      <body className="font-body bg-parchment text-ink-body min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
