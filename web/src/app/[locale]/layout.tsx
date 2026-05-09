import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const SITE_URL = "https://minstrel.live";
const SITE_NAME = "Minstrel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const description =
    locale === "ja"
      ? "日本のゲーム音楽コンサート情報を網羅する専門ポータル。公演スケジュール、チケット情報、演奏団体、ゲームタイトル別に検索できます。"
      : "The dedicated portal for game music concerts in Japan. Search by schedule, tickets, organizers, and game titles.";

  return {
    description,
    openGraph: {
      type: "website",
      locale: locale === "ja" ? "ja_JP" : "en_US",
      url: locale === "ja" ? SITE_URL : `${SITE_URL}/en`,
      siteName: SITE_NAME,
      title: `${SITE_NAME} - ${t("heroTagline")}`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} - ${t("heroTagline")}`,
      description,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  await params;
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <Header />
      <main className="flex-1 pt-16 md:pt-20">
        {children}
      </main>
      <Footer />
    </NextIntlClientProvider>
  );
}
