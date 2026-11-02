import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { AdminSidebar } from "@/components/AdminSidebar";
import { prisma } from "@/lib/prisma";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { withAdmin } from "@/lib/withAdmin";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
  excerpt: z.string().trim().max(500),
  content: z.string().trim().min(1, "Content is required").max(100000),
  coverImage: z.string().trim().url("Must be a valid URL").or(z.literal("")),
  published: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

const EMPTY_FORM: FormData = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  published: false,
};

interface BlogPostRow {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export const getServerSideProps = withAdmin<{ posts: BlogPostRow[] }>(async () => {
  const rows = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      published: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  const posts: BlogPostRow[] = rows.map((r) => ({
    ...r,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return { props: { posts } };
});

export default function AdminBlog({ posts }: { posts: BlogPostRow[] }) {
  const router = useRouter();
  const [postList, setPostList] = useState<BlogPostRow[]>(posts);

  useEffect(() => {
    setPostList(posts);
  }, [posts]);

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

  const openEdit = (p: BlogPostRow) => {
    setEditingId(p.id);
    setServerError(null);
    reset({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? "",
      content: p.content,
      coverImage: p.coverImage ?? "",
      published: p.published,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    const res = await fetch(editingId ? `/api/blog/${editingId}` : "/api/blog", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(
        res.status === 409
          ? "A blog post with this slug already exists."
          : res.status === 401
            ? "Your session expired. Please sign in again."
            : body.error ?? "Something went wrong.",
      );
      return;
    }

    closeForm();
    refresh();
  };

  const onDelete = async (p: BlogPostRow) => {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;

    const previous = postList;
    setPostList((prev) => prev.filter((item) => item.id !== p.id));
    if (editingId === p.id) closeForm();

    const res = await fetch(`/api/blog/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      setPostList(previous);
      window.alert("Failed to delete the blog post.");
    }
  };

  return (
    <>
      <Head>
        <title>Blog – Portfolio Admin</title>
      </Head>

      <div className="flex flex-col md:flex-row min-h-screen bg-slate-100">
        <AdminSidebar />
        <main className="flex-1 p-6 sm:p-8 lg:p-10 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Blog Articles</h1>
              <p className="mt-1 text-sm text-slate-500">Draft, publish, and manage engineering posts.</p>
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
              {showForm ? "Cancel" : "+ New Post"}
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/80 mb-8 space-y-5"
            >
              <h2 className="text-xl font-bold text-slate-900 pb-3 border-b border-slate-100">
                {editingId ? "Edit Post" : "Write New Post"}
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
                    placeholder="my-first-post"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.slug && <p className="text-rose-600 text-xs mt-1">{errors.slug.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Excerpt (optional)</label>
                <input
                  {...register("excerpt")}
                  placeholder="Short preview summary..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {errors.excerpt && (
                  <p className="text-rose-600 text-xs mt-1">{errors.excerpt.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cover Image URL (optional)</label>
                <input
                  {...register("coverImage")}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {errors.coverImage && (
                  <p className="text-rose-600 text-xs mt-1">{errors.coverImage.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Article Content (Markdown / Plaintext)</label>
                <textarea
                  {...register("content")}
                  rows={8}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-y"
                />
                {errors.content && (
                  <p className="text-rose-600 text-xs mt-1">{errors.content.message}</p>
                )}
              </div>

              <div className="flex gap-4 py-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    {...register("published")}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span>Published (Visible on site)</span>
                </label>
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
                {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Post"}
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
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Published Date</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {postList.map((post) => (
                    <tr key={post.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{post.title}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{post.slug}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            post.published
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {post.published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-right space-x-3 text-sm">
                        <button
                          type="button"
                          onClick={() => openEdit(post)}
                          className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(post)}
                          className="font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {postList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No blog posts yet. Write your first one above!
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

