// PATCH  /api/blog/:id — update a blog post (partial)
// DELETE /api/blog/:id — delete a blog post
import { prisma } from "@/lib/prisma";
import { adminApi, parseId } from "@/lib/api";
import { blogPostUpdateSchema } from "@/lib/schemas";
import { invalidateCache } from "@/lib/cache";

export default adminApi({
  async PATCH(req, res) {
    const id = parseId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const data = blogPostUpdateSchema.parse(req.body);

    // If `published` is being changed, set `publishedAt` when publishing for the
    // first time and clear it when unpublishing.
    let publishedAtPatch: { publishedAt?: Date | null } = {};
    if (typeof data.published === "boolean") {
      if (data.published) {
        const existing = await prisma.blogPost.findUnique({
          where: { id },
          select: { publishedAt: true },
        });
        if (!existing) return res.status(404).json({ error: "Not found" });
        if (!existing.publishedAt) publishedAtPatch = { publishedAt: new Date() };
      } else {
        publishedAtPatch = { publishedAt: null };
      }
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: { ...data, ...publishedAtPatch },
    });
    invalidateCache("blog");
    invalidateCache("dashboard");
    res.status(200).json(post);
  },

  async DELETE(req, res) {
    const id = parseId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    await prisma.blogPost.delete({ where: { id } });
    invalidateCache("blog");
    invalidateCache("dashboard");
    res.status(204).end();
  },
});

