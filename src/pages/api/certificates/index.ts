// GET  /api/certificates — list all certificates (ordered by issuedDate / createdAt)
// POST /api/certificates — create a certificate
import { prisma } from "@/lib/prisma";
import { adminApi } from "@/lib/api";
import { certificateInputSchema } from "@/lib/schemas";

export default adminApi({
  async GET(_req, res) {
    if (!prisma.certificate) {
      return res.status(503).json({
        error: "Dev server restart required to load the Certificate model. Please restart npm run dev.",
      });
    }
    const certificates = await prisma.certificate.findMany({
      orderBy: [{ issuedDate: "desc" }, { createdAt: "desc" }],
    });
    res.status(200).json(certificates);
  },

  async POST(req, res) {
    if (!prisma.certificate) {
      return res.status(503).json({
        error: "Dev server restart required to load the Certificate model. Please restart npm run dev.",
      });
    }
    const data = certificateInputSchema.parse(req.body);
    const certificate = await prisma.certificate.create({ data });
    res.status(201).json(certificate);
  },
});

