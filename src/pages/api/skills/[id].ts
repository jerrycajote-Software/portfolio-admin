// PATCH  /api/skills/:id — update a skill (partial)
// DELETE /api/skills/:id — delete a skill
import { prisma } from "@/lib/prisma";
import { adminApi, parseId } from "@/lib/api";
import { skillUpdateSchema } from "@/lib/schemas";

export default adminApi({
  async PATCH(req, res) {
    const id = parseId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const data = skillUpdateSchema.parse(req.body);
    const skill = await prisma.skill.update({ where: { id }, data });
    res.status(200).json(skill);
  },

  async DELETE(req, res) {
    const id = parseId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    await prisma.skill.delete({ where: { id } });
    res.status(204).end();
  },
});
