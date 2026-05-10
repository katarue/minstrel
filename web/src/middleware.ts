import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

function basicAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const [user, pass] = atob(encoded).split(":");
      const validUser = process.env.ADMIN_USERNAME;
      const validPass = process.env.ADMIN_PASSWORD;
      if (user === validUser && pass === validPass) {
        return null; // 認証OK → そのまま通す
      }
    }
  }
  // 認証失敗 → ブラウザにパスワードダイアログを要求
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Minstrel Admin"' },
  });
}

export default function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const authResult = basicAuth(req);
    if (authResult) return authResult;
    return NextResponse.next();
  }
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
