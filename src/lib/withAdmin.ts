// Server-side guard for Pages Router `getServerSideProps`.
// Defense in depth: the proxy already blocks unauthenticated requests, but
// every page that reads data must verify the session itself too.

import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import type { Session } from "next-auth";
import { auth } from "@/auth";

export function withAdmin<P extends Record<string, unknown>>(
  handler: (ctx: GetServerSidePropsContext, session: Session) => ReturnType<GetServerSideProps<P>>,
): GetServerSideProps<P> {
  return async (ctx) => {
    const session = await auth(ctx);
    if (session?.user?.role !== "ADMIN") {
      const callbackUrl = encodeURIComponent(ctx.resolvedUrl);
      return { redirect: { destination: `/login?callbackUrl=${callbackUrl}`, permanent: false } };
    }
    return handler(ctx, session);
  };
}

