// Adds `id` and `role` to the Auth.js session / user / JWT types.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: "USER" | "ADMIN";
  }
  interface Session {
    user: { id: string; role: "USER" | "ADMIN" } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "USER" | "ADMIN";
  }
}

