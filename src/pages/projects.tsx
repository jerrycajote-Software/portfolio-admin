import { useState } from "react";
import { useRouter } from "next/router";
import { AdminSidebar } from "@/components/AdminSidebar";
import { prisma } from "@/lib/prisma";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { withAdmin } from "@/lib/withAdmin";

// Client-side form schema (the API re-validates everything on the server).
const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
  description: z.string().trim().min(1, "Description is required"),
  thumbnailUrl: z.string().trim().url("Must be a valid URL").or(z.literal("")),
  repoUrl: z.string().trim().url("Must be a valid URL").or(z.literal("")),
  liveUrl: z.string().trim().url("Must be a valid URL").or(z.literal("")),
  tagsText: z.string(), // comma separated
  featured: z.boolean(),
  published: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

const EMPTY_FORM: FormData = {
  title: "",
  slug: "",
  description: "",
  thumbnailUrl: "",
  repoUrl: "",
  liveUrl: "",
  tagsText: "",
  featured: false,
  published: false,
};

interface ProjectRow {
  id: number;
  title: string;
  slug: string;
  description: string;
  thumbnailUrl: string | null;
  repoUrl: string | null;
  liveUrl: string | null;
  featured: boolean;
  published: boolean;
  tags: { tag: { id: number; name: string } }[];
}

export const getServerSideProps = withAdmin<{ projects: ProjectRow[] }>(async () => {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      thumbnailUrl: true,
      repoUrl: true,
      liveUrl: true,
      featured: true,
      published: true,
      tags: { select: { tag: { select: { id: true, name: true } } } },
    },
  });

  return { props: { projects } };
});

export default function AdminProjects({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
  });

  const refresh = () => router.replace(router.asPath);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setServerError(null);
    reset(EMPTY_FORM);
  };

  const openCreate = () => {
    setEditingId(null);
    setServerError(null);
    reset(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (p: ProjectRow) => {
    setEditingId(p.id);
    setServerError(null);
    reset({
      title: p.title,
      slug: p.slug,
      description: p.description,
      thumbnailUrl: p.thumbnailUrl ?? "",
      repoUrl: p.repoUrl ?? "",
      liveUrl: p.liveUrl ?? "",
      tagsText: p.tags.map((t) => t.tag.name).join(", "),
      featured: p.featured,
      published: p.published,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async ({ tagsText, ...data }: FormData) => {
    setServerError(null);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await fetch(editingId ? `/api/projects/${editingId}` : "/api/projects", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, tags }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(
        res.status === 409
          ? "A project with this slug already exists."
          : res.status === 401
            ? "Your session expired. Please sign in again."
            : body.error ?? "Something went wrong.",
      );
      return;
    }

    closeForm();
    refresh();
  };

  const onDelete = async (p: ProjectRow) => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      window.alert("Failed to delete the project.");
      return;
    }
    if (editingId === p.id) closeForm();
    refresh();
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Projects</h1>
          <button
            onClick={showForm ? closeForm : openCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            {showForm ? "Cancel" : "+ New Project"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-white p-6 rounded-lg shadow mb-8 space-y-4"
          >
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit project" : "New project"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input {...register("title")} className="w-full p-2 border rounded" />
                {errors.title && <p className="text-red-600 text-sm">{errors.title.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input
                  {...register("slug")}
                  placeholder="my-project"
                  className="w-full p-2 border rounded"
                />
                {errors.slug && <p className="text-red-600 text-sm">{errors.slug.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                {...register("description")}
                rows={3}
                className="w-full p-2 border rounded"
              />
              {errors.description && (
                <p className="text-red-600 text-sm">{errors.description.message}</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Thumbnail URL</label>
                <input {...register("thumbnailUrl")} className="w-full p-2 border rounded" />
                {errors.thumbnailUrl && (
                  <p className="text-red-600 text-sm">{errors.thumbnailUrl.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Repo URL</label>
                <input {...register("repoUrl")} className="w-full p-2 border rounded" />
                {errors.repoUrl && (
                  <p className="text-red-600 text-sm">{errors.repoUrl.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Live URL</label>
                <input {...register("liveUrl")} className="w-full p-2 border rounded" />
                {errors.liveUrl && (
                  <p className="text-red-600 text-sm">{errors.liveUrl.message}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
              <input
                {...register("tagsText")}
                placeholder="React, TypeScript, PostgreSQL"
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" {...register("featured")} />
                Featured
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...register("published")} />
                Published
              </label>
            </div>

            {serverError && (
              <p role="alert" className="text-red-600 text-sm">
                {serverError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Project"}
            </button>
          </form>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Title</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Slug</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Featured</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{project.title}</td>
                  <td className="px-4 py-3 text-gray-500">{project.slug}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        project.published
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {project.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{project.featured ? "⭐" : "—"}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button
                      onClick={() => openEdit(project)}
                      className="text-indigo-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(project)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No projects yet. Create your first one!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
