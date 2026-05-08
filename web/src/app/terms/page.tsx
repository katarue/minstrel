import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約",
  description: "Minstrel の利用規約です。",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
      <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold mb-8">
        利用規約
      </h1>

      <div className="font-body text-ink-body text-base leading-relaxed flex flex-col gap-6">
        <p>
          本利用規約（以下「本規約」）は、Minstrel（以下「本サービス」）の利用条件を定めるものです。
          本サービスをご利用の際は、本規約に同意したものとみなします。
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">1. サービスの概要</h2>
          <p>
            本サービスは、日本国内で開催されるゲーム音楽コンサートの情報を収集・掲載するポータルサイトです。
            掲載情報は公式サイト・公式SNS等の公開情報をもとに作成していますが、
            正確性・完全性を保証するものではありません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">2. 免責事項</h2>
          <ul className="list-disc list-inside flex flex-col gap-1 pl-2">
            <li>掲載情報（日時・会場・チケット情報等）は変更・中止になる場合があります。必ず公式情報をご確認ください。</li>
            <li>本サービスはチケット販売を行っておりません。購入は各公式販売サイトにてお願いします。</li>
            <li>本サービスの利用により生じたいかなる損害についても、運営者は責任を負いません。</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">3. 著作権・知的財産権</h2>
          <p>
            掲載しているコンサート名・ゲームタイトル・画像等の著作権は、各権利者に帰属します。
            本サービスは情報提供を目的としており、各権利者の公式サイトへの誘導を基本方針としています。
          </p>
          <p>
            掲載内容に問題がある場合は、
            <a href="/contact" className="text-bordeaux hover:text-bordeaux/70 underline underline-offset-2">
              お問い合わせフォーム
            </a>
            よりご連絡ください。迅速に対応いたします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">4. 禁止事項</h2>
          <ul className="list-disc list-inside flex flex-col gap-1 pl-2">
            <li>本サービスのコンテンツの無断転載・複製</li>
            <li>本サービスへの不正アクセス・過剰なリクエスト送信</li>
            <li>本サービスを利用した商業目的の行為（運営者の許可なく）</li>
            <li>その他、法令または公序良俗に反する行為</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">5. サービスの変更・停止</h2>
          <p>
            運営者は予告なくサービスの内容を変更・停止する場合があります。
            これによりユーザーに生じた損害について責任を負いません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">6. 準拠法・管轄</h2>
          <p>
            本規約は日本法に準拠します。本サービスに関する紛争については、運営者の所在地を管轄する裁判所を専属的合意管轄とします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">7. 規約の改定</h2>
          <p>
            本規約は必要に応じて改定することがあります。改定後の規約はこのページに掲載します。
          </p>
        </section>

        <p className="text-ink-body/60 text-sm">制定日：2026年5月</p>
      </div>
    </div>
  );
}
