// GET  /api/blog — list all blog posts (drafts included)
// POST /api/blog — create a blog post
import { prisma } from "@/lib/prisma";
import { adminApi } from "@/lib/api";
import { blogPostInputSchema } from "@/lib/schemas";

export default adminApi({
  async GET(_req, res) {
    const posts = await prisma.blogPost.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(posts);
  },

  async POST(req, res) {
    const data = blogPostInputSchema.parse(req.body);
    const post = await prisma.blogPost.create({
      data: {
        ...data,
        publishedAt: data.published ? new Date() : null,
      },
    });
    res.status(201).json(post);
  },
});
