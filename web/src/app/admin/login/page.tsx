import { loginAction } from "./actions";

export const metadata = { title: "管理ログイン – Minstrel" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-parchment border border-gold/30 rounded-lg p-8 w-full max-w-sm shadow-lg">
        <h1 className="font-heading text-bordeaux text-xl font-bold tracking-widest mb-6 text-center">
          管理ダッシュボード
        </h1>
        <form action={loginAction} className="space-y-4">
          {next && <input type="hidden" name="next" value={next} />}
          {error && (
            <p className="text-red-600 text-sm text-center bg-red-50 rounded px-3 py-2">
              ユーザー名またはパスワードが正しくありません
            </p>
          )}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-ink-body mb-1"
            >
              ユーザー名
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="w-full border border-gold/40 rounded px-3 py-2 bg-white text-ink-body focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-ink-body mb-1"
            >
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full border border-gold/40 rounded px-3 py-2 bg-white text-ink-body focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-bordeaux text-parchment font-bold py-2 rounded hover:opacity-80 transition-opacity mt-2"
          >
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
}
