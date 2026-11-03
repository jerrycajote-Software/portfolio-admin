// PATCH  /api/messages/:id — mark a message read / unread
// DELETE /api/messages/:id — delete a message
import { prisma } from "@/lib/prisma";
import { adminApi, parseId } from "@/lib/api";
import { messageUpdateSchema } from "@/lib/schemas";
import { invalidateCache } from "@/lib/cache";

export default adminApi({
  async PATCH(req, res) {
    const id = parseId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const { read } = messageUpdateSchema.parse(req.body);
    const message = await prisma.contactMessage.update({ where: { id }, data: { read } });
    invalidateCache("messages");
    invalidateCache("dashboard");
    res.status(200).json(message);
  },

  async DELETE(req, res) {
    const id = parseId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    await prisma.contactMessage.delete({ where: { id } });
    invalidateCache("messages");
    invalidateCache("dashboard");
    res.status(204).end();
  },
});

