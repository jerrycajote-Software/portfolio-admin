// GET   /api/profile — fetch user profile / bio settings
// PATCH /api/profile — update profile, role, and work location
import { prisma } from "@/lib/prisma";
import { adminApi } from "@/lib/api";
import { profileUpdateSchema } from "@/lib/schemas";
import { invalidateCache } from "@/lib/cache";

export default adminApi({
  async GET(_req, res) {
    let profile = await prisma.profile.findFirst({
      orderBy: { id: "asc" },
    });

    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          fullName: "Jerry Cajote",
          role: "Full Stack Developer",
          location: "Available Globally (Remote)",
          bio: "I build robust, high-performance web applications from database schemas to polished, responsive, and animated user experiences.",
          available: true,
        },
      });
    }

    res.status(200).json(profile);
  },

  async PATCH(req, res) {
    const data = profileUpdateSchema.parse(req.body);

    const existing = await prisma.profile.findFirst({
      orderBy: { id: "asc" },
    });

    let updated;
    if (existing) {
      updated = await prisma.profile.update({
        where: { id: existing.id },
        data,
      });
    } else {
      updated = await prisma.profile.create({
        data: {
          fullName: data.fullName ?? "Jerry Cajote",
          role: data.role ?? "Full Stack Developer",
          location: data.location ?? "Available Globally (Remote)",
          bio: data.bio ?? null,
          available: data.available ?? true,
        },
      });
    }

    invalidateCache("profile");
    invalidateCache("dashboard");
    res.status(200).json(updated);
  },
});

