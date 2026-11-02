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
  const [skillList, setSkillList] = useState<SkillRow[]>(skills);

  useEffect(() => {
    setSkillList(skills);
  }, [skills]);

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

    const previous = skillList;
    setSkillList((prev) => prev.filter((item) => item.id !== s.id));
    if (editingId === s.id) closeForm();

    const res = await fetch(`/api/skills/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      setSkillList(previous);
      window.alert("Failed to delete the skill.");
    }
  };

  return (
    <>
      <Head>
        <title>Skills – Portfolio Admin</title>
      </Head>

      <div className="flex flex-col md:flex-row min-h-screen bg-slate-100">
        <AdminSidebar />
        <main className="flex-1 p-6 sm:p-8 lg:p-10 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Skills &amp; Technologies</h1>
              <p className="mt-1 text-sm text-slate-500">Manage technical stack proficiencies and categories.</p>
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
              {showForm ? "Cancel" : "+ New Skill"}
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/80 mb-8 space-y-5"
            >
              <h2 className="text-xl font-bold text-slate-900 pb-3 border-b border-slate-100">
                {editingId ? "Edit Skill" : "Add New Skill"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Skill Name</label>
                  <input
                    {...register("name")}
                    placeholder="TypeScript"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.name && <p className="text-rose-600 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
                  <input
                    {...register("category")}
                    placeholder="Frontend, Backend, Database, Cloud..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.category && (
                    <p className="text-rose-600 text-xs mt-1">{errors.category.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Proficiency Level (0–100%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    {...register("level")}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.level && <p className="text-rose-600 text-xs mt-1">{errors.level.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Icon (optional class or URL)
                  </label>
                  <input
                    {...register("icon")}
                    placeholder="e.g. devicon-typescript-plain"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.icon && <p className="text-rose-600 text-xs mt-1">{errors.icon.message}</p>}
                </div>
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
                {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Create Skill"}
              </button>
            </form>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider">Proficiency</th>
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {skillList.map((skill) => (
                    <tr key={skill.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{skill.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{skill.category}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full"
                              style={{ width: `${skill.level}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-600">{skill.level}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-3 text-sm">
                        <button
                          type="button"
                          onClick={() => openEdit(skill)}
                          className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(skill)}
                          className="font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {skillList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No skills yet. Add your first one above!
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

