import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/**
 * 旧カレンダー専用ページ。トップページのカレンダーセクションに統合したため、
 * 常にトップページの該当箇所へリダイレクトする（旧 ?year=&month= も新形式に変換して引き継ぐ）。
 */
export default async function CalendarRedirect({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  if (sp.year && sp.month) {
    const month = `${sp.year}-${sp.month.padStart(2, "0")}`;
    redirect({ href: `/?month=${month}#calendar`, locale });
  }
  redirect({ href: "/#calendar", locale });
}
