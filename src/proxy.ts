// Next.js 16 Proxy (formerly middleware) — first line of defense.
// Every admin page and API route requires an ADMIN session; see
// `authorized` in auth.config.ts. Pages also re-check on the server via
// `withAdmin` (src/lib/withAdmin.ts) — never rely on the proxy alone.

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

// Explicit default export so Next 16 detects the proxy function.
export default auth;

export const config = {
  // Everything except Auth.js endpoints, Next internals and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};

