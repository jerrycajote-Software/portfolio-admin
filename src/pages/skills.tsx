import { useState } from "react";
import { useRouter } from "next/router";
import { AdminSidebar } from "@/components/AdminSidebar";
import { prisma } from "@/lib/prisma";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { withAdmin } from "@/lib/withAdmin";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  category: z.string().trim().min(1, "Category is required").max(50),
  icon: z.string().trim().max(300),
  level: z.coerce.number().int().min(0, "Min 0").max(100, "Max 100"),
});

type FormData = z.infer<typeof formSchema>;

const EMPTY_FORM: FormData = {
  name: "",
  category: "Frontend",
  icon: "",
  level: 75,
};

interface SkillRow {
  id: number;
  name: string;
  category: string;
  icon: string | null;
  level: number;
}

export const getServerSideProps = withAdmin<{ skills: SkillRow[] }>(async () => {
  const skills = await prisma.skill.findMany({
    orderBy: [{ category: "asc" }, { level: "desc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, icon: true, level: true },
  });
  return { props: { skills } };
});

export default function AdminSkills({ skills }: { skills: SkillRow[] }) {
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

  const openEdit = (s: SkillRow) => {
    setEditingId(s.id);
    setServerError(null);
    reset({
      name: s.name,
      category: s.category,
      icon: s.icon ?? "",
      level: s.level,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    const res = await fetch(editingId ? `/api/skills/${editingId}` : "/api/skills", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(
        res.status === 409
          ? "A skill with this name already exists."
          : res.status === 401
            ? "Your session expired. Please sign in again."
            : body.error ?? "Something went wrong.",
      );
      return;
    }

    closeForm();
    refresh();
  };

  const onDelete = async (s: SkillRow) => {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/skills/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      window.alert("Failed to delete the skill.");
      return;
    }
    if (editingId === s.id) closeForm();
    refresh();
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Skills</h1>
          <button
            onClick={showForm ? closeForm : openCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            {showForm ? "Cancel" : "+ New Skill"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-white p-6 rounded-lg shadow mb-8 space-y-4"
          >
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit skill" : "New skill"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  {...register("name")}
                  placeholder="TypeScript"
                  className="w-full p-2 border rounded"
                />
                {errors.name && <p className="text-red-600 text-sm">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <input
                  {...register("category")}
                  placeholder="Frontend, Backend, Database, DevOps..."
                  className="w-full p-2 border rounded"
                />
                {errors.category && (
                  <p className="text-red-600 text-sm">{errors.category.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Proficiency Level (0–100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  {...register("level")}
                  className="w-full p-2 border rounded"
                />
                {errors.level && <p className="text-red-600 text-sm">{errors.level.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Icon (optional URL or class)
                </label>
                <input {...register("icon")} className="w-full p-2 border rounded" />
                {errors.icon && <p className="text-red-600 text-sm">{errors.icon.message}</p>}
              </div>
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
              {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Skill"}
            </button>
          </form>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Proficiency</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr key={skill.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{skill.name}</td>
                  <td className="px-4 py-3 text-gray-600">{skill.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${skill.level}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{skill.level}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <button
                      onClick={() => openEdit(skill)}
                      className="text-indigo-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(skill)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {skills.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No skills yet. Add your first one!
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

