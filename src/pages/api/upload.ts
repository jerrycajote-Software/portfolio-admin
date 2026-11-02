import { adminApi } from "@/lib/api";
import { uploadMedia } from "@/lib/storage";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

export default adminApi({
  async POST(req, res) {
    const { dataUrl, filename, contentType, folder } = req.body || {};

    if (!dataUrl || typeof dataUrl !== "string") {
      return res.status(400).json({ error: "Missing dataUrl in request body" });
    }

    const matches = dataUrl.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Invalid base64 Data URL format" });
    }

    const detectedType = matches[1];
    const base64Content = matches[2];
    const mimeType = contentType || detectedType;

    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedMimes.includes(mimeType)) {
      return res.status(400).json({
        error: `Unsupported file type: ${mimeType}. Allowed: ${allowedMimes.join(", ")}`,
      });
    }

    const buffer = Buffer.from(base64Content, "base64");
    const name = filename || `certificate-${Date.now()}.${mimeType === "application/pdf" ? "pdf" : "webp"}`;

    const result = await uploadMedia(
      buffer,
      name,
      mimeType,
      folder || "certificates"
    );

    res.status(200).json(result);
  },
});

