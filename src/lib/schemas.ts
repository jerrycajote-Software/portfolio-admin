// Shared Zod schemas — used by the admin forms (client) and API routes (server).
import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .url("Must be a valid URL")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const projectInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
  description: z.string().trim().min(1, "Description is required").max(1000),
  content: z.string().max(50000).optional().nullable(),
  thumbnailUrl: optionalUrl,
  repoUrl: optionalUrl,
  liveUrl: optionalUrl,
  featured: z.boolean().default(false),
  published: z.boolean().default(false),
  // Tag names; created on demand
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});

export const projectUpdateSchema = projectInputSchema.partial();

export const messageUpdateSchema = z.object({ read: z.boolean() });

export const skillInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  category: z.string().trim().min(1, "Category is required").max(50),
  icon: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  level: z.coerce.number().int().min(0, "Min 0").max(100, "Max 100").default(50),
});

export const skillUpdateSchema = skillInputSchema.partial();

export const blogPostInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
  excerpt: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  content: z.string().trim().min(1, "Content is required").max(100000),
  coverImage: optionalUrl,
  published: z.boolean().default(false),
});

export const blogPostUpdateSchema = blogPostInputSchema.partial();

export type ProjectInput = z.input<typeof projectInputSchema>;
export type SkillInput = z.input<typeof skillInputSchema>;
export type BlogPostInput = z.input<typeof blogPostInputSchema>;

