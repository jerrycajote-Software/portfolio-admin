// Seed script — populates the database with sample data for local development.
// Run with: npx prisma db seed   (safe to re-run; uses upserts)
//
// Admin user:
//   SEED_ADMIN_EMAIL     (default: admin@example.com)
//   SEED_ADMIN_PASSWORD  (optional) — if not set, a random unknown password is
//                        stored. Set it and re-run the seed to update the hash.

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const tags = ["Next.js", "TypeScript", "React", "PostgreSQL", "Prisma", "Tailwind CSS", "Node.js"];

const projects = [
  {
    slug: "personal-portfolio",
    title: "Personal Portfolio",
    description: "Full-stack portfolio with a public site and a separate admin dashboard.",
    content: "Built with Next.js, TypeScript, Prisma and PostgreSQL (Neon). Media is stored in Cloudflare R2 and transformed with Cloudinary.",
    repoUrl: "https://github.com/",
    featured: true,
    tags: ["Next.js", "TypeScript", "Prisma", "PostgreSQL", "Tailwind CSS"],
  },
  {
    slug: "inventory-system",
    title: "Inventory System",
    description: "Sample project — stock tracking with role-based access and reporting.",
    content: "Placeholder content. Replace from the admin dashboard.",
    featured: true,
    tags: ["React", "Node.js", "PostgreSQL"],
  },
  {
    slug: "task-management",
    title: "Task Management App",
    description: "Sample project — kanban-style task board with drag and drop.",
    content: "Placeholder content. Replace from the admin dashboard.",
    featured: false,
    tags: ["React", "TypeScript"],
  },
];

const skills = [
  { name: "TypeScript", category: "Frontend", level: 80 },
  { name: "React", category: "Frontend", level: 80 },
  { name: "Next.js", category: "Frontend", level: 75 },
  { name: "Tailwind CSS", category: "Frontend", level: 75 },
  { name: "Node.js", category: "Backend", level: 70 },
  { name: "Prisma", category: "Database", level: 65 },
  { name: "PostgreSQL", category: "Database", level: 65 },
  { name: "Git", category: "DevOps", level: 75 },
];

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const rawPassword = process.env.SEED_ADMIN_PASSWORD;
  const passwordHash = await bcrypt.hash(rawPassword ?? randomBytes(24).toString("hex"), 12);

  const admin = await prisma.user.upsert({
    where: { email },
    // Only overwrite the password when one was explicitly provided.
    update: { role: Role.ADMIN, ...(rawPassword ? { password: passwordHash } : {}) },
    create: { email, name: "Admin", password: passwordHash, role: Role.ADMIN },
  });

  for (const name of tags) {
    await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
  }

  for (const { tags: projectTags, ...data } of projects) {
    const tagLinks = {
      create: projectTags.map((name) => ({ tag: { connect: { name } } })),
    };
    await prisma.project.upsert({
      where: { slug: data.slug },
      update: { ...data, published: true, tags: { deleteMany: {}, ...tagLinks } },
      create: { ...data, published: true, ownerId: admin.id, tags: tagLinks },
    });
  }

  for (const skill of skills) {
    await prisma.skill.upsert({ where: { name: skill.name }, update: skill, create: skill });
  }

  console.log(
    `Seeded: admin <${email}>${rawPassword ? "" : " (random password — set SEED_ADMIN_PASSWORD to choose one)"}, ` +
      `${tags.length} tags, ${projects.length} projects, ${skills.length} skills`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

