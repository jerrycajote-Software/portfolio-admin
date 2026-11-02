// PATCH  /api/certificates/:id — update a certificate (partial)
// DELETE /api/certificates/:id — delete a certificate
import { prisma } from "@/lib/prisma";
import { adminApi, parseId } from "@/lib/api";
import { certificateUpdateSchema } from "@/lib/schemas";

export default adminApi({
  async PATCH(req, res) {
    if (!prisma.certificate) {
      return res.status(503).json({
        error: "Dev server restart required to load the Certificate model. Please restart npm run dev.",
      });
    }
    const id = parseId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const data = certificateUpdateSchema.parse(req.body);
    const certificate = await prisma.certificate.update({ where: { id }, data });
    res.status(200).json(certificate);
  },

  async DELETE(req, res) {
    if (!prisma.certificate) {
      return res.status(503).json({
        error: "Dev server restart required to load the Certificate model. Please restart npm run dev.",
      });
    }
    const id = parseId(req.query.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    await prisma.certificate.delete({ where: { id } });
    res.status(204).end();
  },
});

