import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // API routes, admin, and static files are excluded
    "/((?!api|admin|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
