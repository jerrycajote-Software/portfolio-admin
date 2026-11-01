import { useState } from "react";
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
    const res = await fetch(`/api/blog/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      window.alert("Failed to delete the blog post.");
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
          <h1 className="text-3xl font-bold">Blog Posts</h1>
          <button
            onClick={showForm ? closeForm : openCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            {showForm ? "Cancel" : "+ New Post"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-white p-6 rounded-lg shadow mb-8 space-y-4"
          >
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit post" : "New post"}
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
                  placeholder="my-first-post"
                  className="w-full p-2 border rounded"
                />
                {errors.slug && <p className="text-red-600 text-sm">{errors.slug.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Excerpt (optional)</label>
              <input {...register("excerpt")} className="w-full p-2 border rounded" />
              {errors.excerpt && (
                <p className="text-red-600 text-sm">{errors.excerpt.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cover Image URL (optional)</label>
              <input {...register("coverImage")} className="w-full p-2 border rounded" />
              {errors.coverImage && (
                <p className="text-red-600 text-sm">{errors.coverImage.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <textarea
                {...register("content")}
                rows={8}
                className="w-full p-2 border rounded font-mono text-sm"
              />
              {errors.content && (
                <p className="text-red-600 text-sm">{errors.content.message}</p>
              )}
            </div>
            <div className="flex gap-4">
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
              {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Post"}
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
                <th className="px-4 py-3 text-left text-sm font-semibold">Published At</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{post.title}</td>
                  <td className="px-4 py-3 text-gray-500">{post.slug}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        post.published
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {post.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <button
                      onClick={() => openEdit(post)}
                      className="text-indigo-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(post)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No blog posts yet. Write your first one!
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

