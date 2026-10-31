// GET  /api/projects  — list all projects (including drafts)
// POST /api/projects  — create a project
import { prisma } from "@/lib/prisma";
import { adminApi } from "@/lib/api";
import { projectInputSchema } from "@/lib/schemas";

export default adminApi({
  async GET(_req, res) {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { tags: { include: { tag: true } } },
    });
    res.status(200).json(projects);
  },

  async POST(req, res, userId) {
    const { tags, ...data } = projectInputSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        ...data,
        ownerId: userId,
        tags: {
          create: Array.from(new Set(tags)).map((name) => ({
            tag: { connectOrCreate: { where: { name }, create: { name } } },
          })),
        },
      },
      include: { tags: { include: { tag: true } } },
    });
    res.status(201).json(project);
  },
});
