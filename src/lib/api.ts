// Helpers for admin API routes (Pages Router).
import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { auth } from "@/auth";

type Handler = (req: NextApiRequest, res: NextApiResponse, userId: number) => Promise<void>;
type Methods = Partial<Record<"GET" | "POST" | "PATCH" | "DELETE", Handler>>;

/**
 * Routes a request by HTTP method, after verifying an ADMIN session.
 * Maps validation / database errors to proper status codes.
 */
export function adminApi(methods: Methods) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const session = await auth(req, res);
      if (session?.user?.role !== "ADMIN") {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const handler = methods[req.method as keyof Methods];
      if (!handler) {
        res.setHeader("Allow", Object.keys(methods));
        return res.status(405).json({ error: "Method not allowed" });
      }

      await handler(req, res, Number(session.user.id));
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", issues: e.flatten().fieldErrors });
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") return res.status(409).json({ error: "Already exists (duplicate value)" });
        if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
      }
      console.error("[api]", req.method, req.url, e);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

/** Parses a dynamic `[id]` route param into a positive integer, or null. */
export function parseId(value: string | string[] | undefined): number | null {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
