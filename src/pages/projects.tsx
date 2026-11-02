import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { AdminSidebar } from "@/components/AdminSidebar";
import { DemoVideosManager, type DemoVideo } from "@/components/DemoVideosManager";
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
  demoVideos: string | null;
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
      demoVideos: true,
      featured: true,
      published: true,
      tags: { select: { tag: { select: { id: true, name: true } } } },
    },
  });

  return { props: { projects } };
});

export default function AdminProjects({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [projectList, setProjectList] = useState<ProjectRow[]>(projects);

  useEffect(() => {
    setProjectList(projects);
  }, [projects]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [demoVideos, setDemoVideos] = useState<DemoVideo[]>([]);

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
    setDemoVideos([]);
    reset(EMPTY_FORM);
  };

  const openCreate = () => {
    setEditingId(null);
    setServerError(null);
    setDemoVideos([]);
    reset(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (p: ProjectRow) => {
    setEditingId(p.id);
    setServerError(null);
    let loadedVideos: DemoVideo[] = [];
    if (p.demoVideos) {
      try {
        loadedVideos = JSON.parse(p.demoVideos);
      } catch {}
    }
    setDemoVideos(loadedVideos);

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

    const payload = {
      ...data,
      tags,
      demoVideos: demoVideos.length > 0 ? JSON.stringify(demoVideos) : null,
    };

    const res = await fetch(editingId ? `/api/projects/${editingId}` : "/api/projects", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

    const previous = projectList;
    setProjectList((prev) => prev.filter((item) => item.id !== p.id));
    if (editingId === p.id) closeForm();

    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      setProjectList(previous);
      window.alert("Failed to delete the project.");
    }
  };

  return (
    <>
      <Head>
        <title>Projects – Portfolio Admin</title>
      </Head>

      <div className="flex flex-col md:flex-row min-h-screen bg-slate-100">
        <AdminSidebar />
        <main className="flex-1 p-6 sm:p-8 lg:p-10 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Projects</h1>
              <p className="mt-1 text-sm text-slate-500">Manage your showcased portfolio works.</p>
            </div>
            <button
              type="button"
              onClick={showForm ? closeForm : openCreate}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md ${
                showForm
                  ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25"
              }`}
            >
              {showForm ? "Cancel" : "+ New Project"}
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/80 mb-8 space-y-5"
            >
              <h2 className="text-xl font-bold text-slate-900 pb-3 border-b border-slate-100">
                {editingId ? "Edit Project" : "Create New Project"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title</label>
                  <input
                    {...register("title")}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.title && <p className="text-rose-600 text-xs mt-1">{errors.title.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Slug</label>
                  <input
                    {...register("slug")}
                    placeholder="my-project"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.slug && <p className="text-rose-600 text-xs mt-1">{errors.slug.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {errors.description && (
                  <p className="text-rose-600 text-xs mt-1">{errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Thumbnail URL</label>
                  <input
                    {...register("thumbnailUrl")}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.thumbnailUrl && (
                    <p className="text-rose-600 text-xs mt-1">{errors.thumbnailUrl.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Repo URL</label>
                  <input
                    {...register("repoUrl")}
                    placeholder="https://github.com/..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.repoUrl && (
                    <p className="text-rose-600 text-xs mt-1">{errors.repoUrl.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Live URL</label>
                  <input
                    {...register("liveUrl")}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.liveUrl && (
                    <p className="text-rose-600 text-xs mt-1">{errors.liveUrl.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Tags (comma separated)
                </label>
                <input
                  {...register("tagsText")}
                  placeholder="React, TypeScript, PostgreSQL"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex gap-6 py-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    {...register("featured")}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span>Featured Project</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    {...register("published")}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span>Published (Visible on site)</span>
                </label>
              </div>

              {/* Demo Videos Showcase Manager */}
              <div className="pt-2 border-t border-slate-100">
                <DemoVideosManager videos={demoVideos} onChange={setDemoVideos} />
              </div>

              {serverError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all"
              >
                {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Project"}
              </button>
            </form>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Slug</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Videos</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Featured</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projectList.map((project) => (
                    <tr key={project.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{project.title}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{project.slug}</td>
                      <td className="px-6 py-4 text-sm">
                        {project.demoVideos ? (
                          (() => {
                            try {
                              const count = (JSON.parse(project.demoVideos) as unknown[]).length;
                              return count > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                  🎬 {count} {count === 1 ? "video" : "videos"}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              );
                            } catch {
                              return <span className="text-slate-400">—</span>;
                            }
                          })()
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            project.published
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {project.published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {project.featured ? <span className="text-amber-500 font-bold">★ Featured</span> : "—"}
                      </td>
                      <td className="px-6 py-4 text-right space-x-3 text-sm">
                        <button
                          type="button"
                          onClick={() => openEdit(project)}
                          className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(project)}
                          className="font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {projectList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        No projects yet. Create your first one above!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
