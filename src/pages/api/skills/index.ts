// GET  /api/skills — list all skills
// POST /api/skills — create a skill
import { prisma } from "@/lib/prisma";
import { adminApi } from "@/lib/api";
import { skillInputSchema } from "@/lib/schemas";

export default adminApi({
  async GET(_req, res) {
    const skills = await prisma.skill.findMany({
      orderBy: [{ category: "asc" }, { level: "desc" }, { name: "asc" }],
    });
    res.status(200).json(skills);
  },

  async POST(req, res) {
    const data = skillInputSchema.parse(req.body);
    const skill = await prisma.skill.create({ data });
    res.status(201).json(skill);
  },
});
