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

    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1 || !dataUrl.startsWith("data:")) {
      return res.status(400).json({ error: "Invalid base64 Data URL format" });
    }

    const header = dataUrl.substring(5, commaIndex);
    const detectedType = header.split(";")[0]?.trim();
    const base64Content = dataUrl.substring(commaIndex + 1).replace(/\s/g, "");
    const mimeType = contentType || detectedType;

    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
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
