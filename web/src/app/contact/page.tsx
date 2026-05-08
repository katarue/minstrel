import type { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "Minstrel へのお問い合わせはこちらから。掲載情報の削除・修正依頼もこちらをご利用ください。",
};

export default function ContactPage() {
  return (
    <div className="max-w-xl mx-auto px-4 md:px-8 py-12">
      <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold mb-3">
        お問い合わせ
      </h1>
      <p className="font-body text-ink-body/70 text-sm mb-8">
        掲載情報の削除・修正依頼、イベント情報の掲載依頼、その他のご連絡はこちらからどうぞ。
      </p>

      <div
        className="bg-parchment-dark rounded-md p-6 md:p-8"
        style={{ boxShadow: "0 2px 8px rgba(59, 47, 29, 0.12)" }}
      >
        <ContactForm />
      </div>
    </div>
  );
}
