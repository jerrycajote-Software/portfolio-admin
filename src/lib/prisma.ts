import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

if (process.env.NODE_ENV !== "production") {
  // Purge require cache for Prisma client in dev if schema updated
  if (typeof require !== "undefined" && require.cache) {
    Object.keys(require.cache).forEach((key) => {
      if (key.includes(".prisma") || key.includes("@prisma/client")) {
        delete require.cache[key];
      }
    });
  }
  delete globalForPrisma.prisma;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
