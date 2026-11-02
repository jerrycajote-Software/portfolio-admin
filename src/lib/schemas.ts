// Shared Zod schemas — used by the admin forms (client) and API routes (server).
import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(""))
  .refine((v) => !v || /^https?:\/\//i.test(v), {
    message: "Must be a valid URL starting with http:// or https://",
  })
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
  demoVideos: z
    .string()
    .trim()
    .max(50000)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
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

const optionalUrlOrPath = z
  .string()
  .trim()
  .optional()
  .nullable()
  .or(z.literal(""))
  .refine(
    (v) => !v || v.startsWith("/") || /^https?:\/\//i.test(v),
    { message: "Must be a valid URL or path (e.g. /image.png or https://...)" }
  )
  .transform((v) => (v ? v : null));

export const certificateInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  issuer: z.string().trim().min(1, "Issuer is required").max(100),
  issuedDate: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? new Date(v) : null)),
  credentialId: z
    .string()
    .trim()
    .max(150)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  verificationUrl: optionalUrl,
  imageUrl: optionalUrlOrPath,
  pdfUrl: optionalUrlOrPath,
  blurData: z
    .string()
    .trim()
    .max(25000)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
});

export const certificateUpdateSchema = certificateInputSchema.partial();

export const profileInputSchema = z.object({
  fullName: z.string().trim().min(1, "Full Name is required").max(100),
  role: z.string().trim().min(1, "Role is required").max(100),
  location: z.string().trim().min(1, "Work Location is required").max(150),
  bio: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  available: z.boolean().default(true),
});

export const profileUpdateSchema = profileInputSchema.partial();

export type ProjectInput = z.input<typeof projectInputSchema>;
export type SkillInput = z.input<typeof skillInputSchema>;
export type BlogPostInput = z.input<typeof blogPostInputSchema>;
export type CertificateInput = z.input<typeof certificateInputSchema>;
export type ProfileInput = z.input<typeof profileInputSchema>;


