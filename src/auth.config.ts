// Auth.js v5 — shared config (no Prisma / bcrypt imports).
// Used by both `src/auth.ts` (full config) and `src/proxy.ts` (route guard),
// so it must stay lightweight and free of database access.

import type { NextAuthConfig } from "next-auth";

const PUBLIC_PATHS = ["/login"];

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 }, // 8 hours
  providers: [], // added in src/auth.ts
  callbacks: {
    // Runs in src/proxy.ts for every matched request.
    authorized({ auth, request: { nextUrl } }) {
      const isAdmin = auth?.user?.role === "ADMIN";
      const isPublic = PUBLIC_PATHS.includes(nextUrl.pathname);

      // Already signed in → keep admins away from the login page.
      if (isPublic) {
        return isAdmin ? Response.redirect(new URL("/dashboard", nextUrl)) : true;
      }

      if (isAdmin) {
        return nextUrl.pathname === "/" ? Response.redirect(new URL("/dashboard", nextUrl)) : true;
      }

      // API routes get a JSON 401 instead of a redirect to the login page.
      if (nextUrl.pathname.startsWith("/api/")) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      return false; // → redirect to pages.signIn with ?callbackUrl=
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "USER" | "ADMIN";
      return session;
    },
  },
} satisfies NextAuthConfig;

