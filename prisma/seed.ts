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
  { name: "TypeScript", category: "Frontend", level: 80, icon: "typescript" },
  { name: "React", category: "Frontend", level: 80, icon: "react" },
  { name: "Next.js", category: "Frontend", level: 75, icon: "nextjs" },
  { name: "Tailwind CSS", category: "Frontend", level: 75, icon: "tailwindcss" },
  { name: "Node.js", category: "Backend", level: 70, icon: "nodejs" },
  { name: "Prisma", category: "Database", level: 65, icon: "prisma" },
  { name: "PostgreSQL", category: "Database", level: 65, icon: "postgresql" },
  { name: "Git", category: "DevOps", level: 75, icon: "git" },
];

const blogPosts = [
  {
    slug: "building-my-portfolio-with-nextjs-and-prisma",
    title: "Building My Portfolio with Next.js, TypeScript, and Prisma",
    excerpt:
      "How I designed a two-app portfolio architecture with a public Next.js frontend, a protected admin dashboard, and a shared Neon PostgreSQL database.",
    content:
      "This portfolio separates the public-facing site (`portfolio-frontend`) from the content management dashboard (`portfolio-admin`), while sharing a single PostgreSQL database hosted on Neon.\n\n## Why Two Apps?\n\nKeeping the admin interface in its own application means the public site has zero authentication overhead and a smaller attack surface, while the admin app enforces strict Auth.js v5 session checks at both the proxy and route levels.\n\n## Type-Safe Data Layer\n\nBoth applications generate their Prisma Client from the same schema, giving end-to-end TypeScript safety from PostgreSQL tables all the way to React components.",
    published: true,
    publishedAt: new Date("2026-10-30T00:00:00Z"),
  },
];

const certificates = [
  {
    title: "AWS Certified Cloud Practitioner",
    issuer: "Amazon Web Services",
    issuedDate: new Date("2026-05-15"),
    credentialId: "AWS-CCP-2026-89104",
    verificationUrl: "https://aws.amazon.com/verification",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
    blurData: JSON.stringify({ x: 64, y: 76, width: 30, height: 18, blurIntensity: 14, showWatermark: true }),
    description: "Cloud concepts, AWS security and compliance, core services, and billing practices.",
    featured: true,
    published: true,
  },
  {
    title: "Meta Front-End Developer Professional Certificate",
    issuer: "Meta",
    issuedDate: new Date("2026-03-20"),
    credentialId: "META-FED-772910",
    verificationUrl: "https://coursera.org/verify/professional-cert/meta-front-end",
    imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80",
    description: "Comprehensive front-end engineering program covering React, modern JavaScript, UI/UX, and testing.",
    featured: true,
    published: true,
  },
  {
    title: "PostgreSQL Advanced Queries & Performance Optimization",
    issuer: "Database Engineering Institute",
    issuedDate: new Date("2026-01-10"),
    credentialId: "PG-OPT-3392",
    verificationUrl: "https://example.com/verify/pg-opt",
    imageUrl: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&auto=format&fit=crop&q=80",
    description: "Indexing strategies, query execution planner analysis, and high-concurrency database architecture.",
    featured: false,
    published: true,
  },
];

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
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
      update: { ...data, published: true, ownerId: admin.id, tags: { deleteMany: {}, ...tagLinks } },
      create: { ...data, published: true, ownerId: admin.id, tags: tagLinks },
    });
  }

  for (const skill of skills) {
    await prisma.skill.upsert({ where: { name: skill.name }, update: skill, create: skill });
  }

  for (const post of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: post,
      create: post,
    });
  }

  for (const cert of certificates) {
    const existing = await prisma.certificate.findFirst({
      where: { title: cert.title, issuer: cert.issuer },
    });
    if (existing) {
      await prisma.certificate.update({
        where: { id: existing.id },
        data: cert,
      });
    } else {
      await prisma.certificate.create({
        data: cert,
      });
    }
  }

  console.log(
    `Seeded: admin <${email}>${rawPassword ? "" : " (random password — set SEED_ADMIN_PASSWORD to choose one)"}, ` +
      `${tags.length} tags, ${projects.length} projects, ${skills.length} skills, ${blogPosts.length} blog posts, ${certificates.length} certificates`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

