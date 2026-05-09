import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("policy");
  return { title: t("title") };
}

export default async function PolicyPage() {
  const t = await getTranslations("policy");

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
      <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold mb-8">{t("title")}</h1>

      <div className="font-body text-ink-body text-base leading-relaxed flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">{t("title")}</h2>
          <p>{t("intro")}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">{t("definitionTitle")}</h2>
          <p>{t("definitionBody")}</p>
          <div className="bg-parchment-dark rounded-md p-4 flex flex-col gap-2 text-sm">
            <p className="font-semibold text-ink-heading">{t("includedLabel")}</p>
            <ul className="list-disc list-inside flex flex-col gap-1 pl-1 text-ink-body/90">
              {(t.raw("includedItems") as string[]).map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <div className="bg-parchment-dark rounded-md p-4 flex flex-col gap-2 text-sm">
            <p className="font-semibold text-ink-heading">{t("excludedLabel")}</p>
            <ul className="list-disc list-inside flex flex-col gap-1 pl-1 text-ink-body/90">
              {(t.raw("excludedItems") as string[]).map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
          <p className="text-sm text-ink-body/70">{t("mixedNote")}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">{t("collectionTitle")}</h2>
          <p>{t("collectionBody1")}</p>
          <p>{t("collectionBody2")}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">{t("removalTitle")}</h2>
          <p>{t("removalBody")}</p>
        </section>
      </div>
    </div>
  );
}
