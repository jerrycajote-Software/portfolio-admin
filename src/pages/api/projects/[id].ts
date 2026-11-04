// PATCH  /api/projects/:id — update a project (partial)
// DELETE /api/projects/:id — delete a project
import { prisma } from "@/lib/prisma";
import { adminApi, parseId } from "@/lib/api";
import { projectUpdateSchema } from "@/lib/schemas";
import { invalidateCache } from "@/lib/cache";

export default adminApi({
  async PATCH(req, res) {
    const id = parseId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const { tags, ...data } = projectUpdateSchema.parse(req.body);

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...data,
        // Only touch tags when the client sent them; replace the full set.
        ...(tags && {
          tags: {
            deleteMany: {},
            create: Array.from(new Set(tags)).map((name) => ({
              tag: { connectOrCreate: { where: { name }, create: { name } } },
            })),
          },
        }),
      },
      include: { tags: { include: { tag: true } } },
    });
    invalidateCache("projects");
    invalidateCache("dashboard");
    res.status(200).json(project);
  },

  async DELETE(req, res) {
    const id = parseId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    await prisma.project.delete({ where: { id } }); // ProjectTag rows cascade
    invalidateCache("projects");
    invalidateCache("dashboard");
    res.status(204).end();
  },
});
