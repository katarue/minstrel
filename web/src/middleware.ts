import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "./lib/session";

const intlMiddleware = createMiddleware(routing);

async function adminAuth(req: NextRequest): Promise<NextResponse | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  if (token && secret && (await verifySessionToken(token, secret))) {
    return null; // 認証OK → 通す
  }
  const next = req.nextUrl.pathname + req.nextUrl.search;
  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("next", next);
  return NextResponse.redirect(loginUrl);
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) return NextResponse.next();
    const authResult = await adminAuth(req);
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
