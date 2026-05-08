import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "Minstrel のプライバシーポリシーです。",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
      <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold mb-8">
        プライバシーポリシー
      </h1>

      <div className="font-body text-ink-body text-base leading-relaxed flex flex-col gap-6">
        <p>
          Minstrel（以下「本サービス」）は、ユーザーの個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">1. 収集する情報</h2>
          <p>本サービスでは、以下の情報を収集する場合があります。</p>
          <ul className="list-disc list-inside flex flex-col gap-1 pl-2">
            <li>お問い合わせフォームよりご入力いただいたお名前・メールアドレス・お問い合わせ内容</li>
            <li>アクセスログ（IPアドレス、ブラウザ情報、参照元URL等）</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">2. 利用目的</h2>
          <ul className="list-disc list-inside flex flex-col gap-1 pl-2">
            <li>お問い合わせへの回答・対応</li>
            <li>サービスの改善・不具合対応</li>
            <li>不正利用の防止</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">3. 第三者への提供</h2>
          <p>
            法令に基づく場合を除き、ご本人の同意なく第三者に個人情報を提供することはありません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">4. アクセス解析</h2>
          <p>
            本サービスでは、サービス改善のためにアクセス解析ツールを使用する場合があります。
            収集されるデータは匿名化されており、個人を特定するものではありません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">5. 情報の管理</h2>
          <p>
            収集した個人情報は適切に管理し、紛失・漏洩・改ざん等の防止に努めます。
            利用目的に必要な期間を経過した情報は適切な方法で削除します。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">6. お問い合わせ</h2>
          <p>
            個人情報の開示・訂正・削除に関するご要望、またはプライバシーポリシーに関するお問い合わせは、
            <a href="/contact" className="text-bordeaux hover:text-bordeaux/70 underline underline-offset-2">
              お問い合わせフォーム
            </a>
            よりご連絡ください。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">7. 改定</h2>
          <p>
            本ポリシーは必要に応じて改定することがあります。改定後のポリシーはこのページに掲載します。
          </p>
        </section>

        <p className="text-ink-body/60 text-sm">制定日：2026年5月</p>
      </div>
    </div>
  );
}
