import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // API routes and static files are excluded
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
