import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "掲載基準",
  description: "Minstrel に掲載するコンサート情報の選定基準について説明します。",
};

export default function PolicyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
      <h1 className="font-heading text-ink-heading text-2xl md:text-3xl font-bold mb-8">
        掲載基準
      </h1>

      <div className="font-body text-ink-body text-base leading-relaxed flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">
            Minstrel が掲載するコンサートについて
          </h2>
          <p>
            Minstrel は、日本国内で開催される「ゲーム音楽コンサート」の情報を専門的に収集・掲載するポータルサイトです。
            すべてのコンサートを網羅することを目的とせず、ゲーム音楽に特化した情報を正確にお届けすることを優先しています。
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">
            「ゲーム音楽」の定義
          </h2>
          <p>
            Minstrel では、<strong>「ゲームが発祥（原作）の楽曲」</strong>を演奏するコンサートを掲載対象としています。
            具体的には、ビデオゲームのサウンドトラックや、ゲームのために作られた楽曲を演奏するコンサートが対象です。
          </p>
          <div className="bg-parchment-dark rounded-md p-4 flex flex-col gap-2 text-sm">
            <p className="font-semibold text-ink-heading">掲載対象の例</p>
            <ul className="list-disc list-inside flex flex-col gap-1 pl-1 text-ink-body/90">
              <li>ファイナルファンタジー、ゼルダの伝説、ドラゴンクエスト等のゲーム音楽を演奏するコンサート</li>
              <li>ゲームのサウンドトラックをテーマにしたオーケストラ・吹奏楽演奏会</li>
            </ul>
          </div>
          <div className="bg-parchment-dark rounded-md p-4 flex flex-col gap-2 text-sm">
            <p className="font-semibold text-ink-heading">掲載対象外の例</p>
            <ul className="list-disc list-inside flex flex-col gap-1 pl-1 text-ink-body/90">
              <li>アニメ・漫画・映画が原作のIP（後からゲーム化された作品）の楽曲のみを演奏するコンサート</li>
              <li>ゲーム音楽を含まないアニメソング・J-POP等のコンサート</li>
            </ul>
          </div>
          <p className="text-sm text-ink-body/70">
            ゲーム音楽とそれ以外の楽曲を組み合わせたプログラムの場合は、内容を確認のうえ掲載を判断しています。
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">
            情報の収集・確認方法
          </h2>
          <p>
            掲載情報は、公式チケットサイト・主催者公式サイト・公式SNS等から自動的に収集しています。
            収集した情報は機械的な検証を経たうえで掲載されますが、内容の正確性を完全に保証するものではありません。
          </p>
          <p>
            最新の公演情報・チケット販売状況・開催有無については、必ず各コンサートの公式情報をご確認ください。
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-ink-heading text-lg font-semibold">
            掲載情報の削除・修正について
          </h2>
          <p>
            掲載内容に誤りがある場合や、権利者・主催者からの削除要請については、速やかに対応いたします。
            お問い合わせページよりご連絡ください。
          </p>
        </section>
      </div>
    </div>
  );
}
