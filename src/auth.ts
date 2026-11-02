// Auth.js v5 — full config with the Credentials provider (email + password).
// Only users with role ADMIN can sign in.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Compared against when the email doesn't exist, so response time doesn't
// reveal which emails are registered. Pre-computed with cost 12 to avoid
// blocking the Node.js event loop on module import.
const DUMMY_HASH = "$2b$12$tZqtSI.qnuCH0v7lLeA8cOVNecUC0OeEYLDktfV/FEa42VFamzyHu";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

        const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
        if (!user || !valid || user.role !== "ADMIN") return null;

        return { id: String(user.id), email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
