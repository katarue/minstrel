import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import SubmitForm from "./SubmitForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("submit");
  return { title: t("title") };
}

export default async function SubmitPage() {
  const t = await getTranslations("submit");
  return (
    <div className="max-w-xl mx-auto px-4 md:px-8 py-12">
      <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold mb-2">
        {t("title")}
      </h1>
      <p className="font-body text-ink-body/70 text-sm mb-2">{t("subtitle")}</p>
      <p className="font-body text-ink-body/60 text-xs mb-8 bg-parchment-dark border border-gold/30 rounded px-4 py-3">
        {t("note")}
      </p>
      <div className="bg-parchment-dark rounded-md p-6 md:p-8"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}>
        <SubmitForm />
      </div>
    </div>
  );
}
