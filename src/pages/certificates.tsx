import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { AdminSidebar } from "@/components/AdminSidebar";
import { SignatureRedactionTool } from "@/components/SignatureRedactionTool";
import { prisma } from "@/lib/prisma";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { withAdmin } from "@/lib/withAdmin";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  issuer: z.string().trim().min(1, "Issuer is required").max(100),
  issuedDate: z.string().trim().optional().nullable().or(z.literal("")),
  credentialId: z.string().trim().max(150).optional().nullable().or(z.literal("")),
  verificationUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal(""))
    .refine((v) => !v || /^https?:\/\//i.test(v), {
      message: "Must be a valid URL starting with http:// or https://",
    }),
  imageUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal(""))
    .refine(
      (v) => !v || v.startsWith("/") || /^https?:\/\//i.test(v),
      { message: "Must be a valid URL or path (e.g. /image.png or https://...)" }
    ),
  pdfUrl: z.string().trim().optional().nullable().or(z.literal("")),
  blurData: z.string().trim().optional().nullable().or(z.literal("")),
  description: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
  featured: z.boolean(),
  published: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

const EMPTY_FORM: FormData = {
  title: "",
  issuer: "",
  issuedDate: "",
  credentialId: "",
  verificationUrl: "",
  imageUrl: "",
  pdfUrl: "",
  blurData: "",
  description: "",
  featured: false,
  published: true,
};

interface CertificateRow {
  id: number;
  title: string;
  issuer: string;
  issuedDate: string | null;
  credentialId: string | null;
  verificationUrl: string | null;
  imageUrl: string | null;
  pdfUrl: string | null;
  blurData: string | null;
  description: string | null;
  featured: boolean;
  published: boolean;
}

export const getServerSideProps = withAdmin<{
  certificates: CertificateRow[];
  needsRestart?: boolean;
}>(async () => {
  if (!prisma.certificate) {
    return {
      props: {
        certificates: [],
        needsRestart: true,
      },
    };
  }

  const rawCertificates = await prisma.certificate.findMany({
    orderBy: [{ issuedDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      issuer: true,
      issuedDate: true,
      credentialId: true,
      verificationUrl: true,
      imageUrl: true,
      pdfUrl: true,
      blurData: true,
      description: true,
      featured: true,
      published: true,
    },
  });

  const certificates: CertificateRow[] = rawCertificates.map((c) => ({
    ...c,
    issuedDate: c.issuedDate ? c.issuedDate.toISOString() : null,
  }));

  return { props: { certificates, needsRestart: false } };
});

export default function AdminCertificates({
  certificates,
  needsRestart,
}: {
  certificates: CertificateRow[];
  needsRestart?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CertificateRow[]>(certificates);

  useEffect(() => {
    setItems(certificates);
  }, [certificates]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
  });

  const currentImageUrl = watch("imageUrl");

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

  const openEdit = (c: CertificateRow) => {
    setEditingId(c.id);
    setServerError(null);

    let formattedDate = "";
    if (c.issuedDate) {
      try {
        formattedDate = new Date(c.issuedDate).toISOString().substring(0, 10);
      } catch {
        formattedDate = "";
      }
    }

    reset({
      title: c.title,
      issuer: c.issuer,
      issuedDate: formattedDate,
      credentialId: c.credentialId ?? "",
      verificationUrl: c.verificationUrl ?? "",
      imageUrl: c.imageUrl ?? "",
      pdfUrl: c.pdfUrl ?? "",
      blurData: c.blurData ?? "",
      description: c.description ?? "",
      featured: c.featured,
      published: c.published,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    const payload = {
      ...data,
      issuedDate: data.issuedDate ? data.issuedDate : null,
      credentialId: data.credentialId ? data.credentialId : null,
      verificationUrl: data.verificationUrl ? data.verificationUrl : null,
      imageUrl: data.imageUrl ? data.imageUrl : null,
      pdfUrl: data.pdfUrl ? data.pdfUrl : null,
      blurData: data.blurData ? data.blurData : null,
      description: data.description ? data.description : null,
    };

    const res = await fetch(
      editingId ? `/api/certificates/${editingId}` : "/api/certificates",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error || "Failed to save certificate. Please try again.");
      return;
    }

    closeForm();
    refresh();
  };

  const onToggleField = async (
    id: number,
    field: "published" | "featured",
    currentVal: boolean
  ) => {
    setItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: !currentVal } : c))
    );

    const res = await fetch(`/api/certificates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !currentVal }),
    });

    if (!res.ok) {
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, [field]: currentVal } : c))
      );
      window.alert(`Failed to update ${field} status.`);
    }
  };

  const onDelete = async (c: CertificateRow) => {
    if (!window.confirm(`Delete certificate "${c.title}"? This cannot be undone.`)) {
      return;
    }
    const previous = items;
    setItems((prev) => prev.filter((item) => item.id !== c.id));
    if (editingId === c.id) closeForm();

    const res = await fetch(`/api/certificates/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      setItems(previous);
      window.alert("Failed to delete certificate.");
    }
  };

  const formatDateDisplay = (isoStr: string | null) => {
    if (!isoStr) return "N/A";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <>
      <Head>
        <title>Certificates – Portfolio Admin</title>
      </Head>

      <div className="flex flex-col md:flex-row min-h-screen bg-slate-100">
        <AdminSidebar />

        <main className="flex-1 p-6 sm:p-8 lg:p-10 w-full min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Certificates &amp; Credentials
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage professional certifications, issuing organizations, and verification credentials.
              </p>
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
              {showForm ? "Cancel" : "+ New Certificate"}
            </button>
          </div>

          {needsRestart && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3 shadow-sm">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-bold">Dev Server Restart Required</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Because new database models were added to Prisma, the active Node dev server is holding the previous in-memory client. Please stop your dev server in the terminal (press <kbd className="px-1.5 py-0.5 bg-amber-100 rounded font-mono font-bold">Ctrl + C</kbd>) and run <code className="px-1.5 py-0.5 bg-amber-100 rounded font-mono font-bold">npm run dev</code> or run <code className="px-1.5 py-0.5 bg-amber-100 rounded font-mono font-bold">powershell -File .\run_agents.ps1</code> to load the updated Prisma client.
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          {showForm && (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/80 mb-8 space-y-6"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingId ? "Edit Certificate" : "Add New Certificate"}
                </h2>
                <span className="text-xs text-slate-400 font-medium">
                  {editingId ? `ID: #${editingId}` : "Draft or Live"}
                </span>
              </div>

              {serverError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                  {serverError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Certificate Title *
                  </label>
                  <input
                    {...register("title")}
                    placeholder="e.g. AWS Certified Solutions Architect"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.title && (
                    <p className="text-rose-600 text-xs mt-1">{errors.title.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Issuing Organization *
                  </label>
                  <input
                    {...register("issuer")}
                    placeholder="e.g. Amazon Web Services, Meta, Coursera"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.issuer && (
                    <p className="text-rose-600 text-xs mt-1">{errors.issuer.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Issued Date (Optional)
                  </label>
                  <input
                    type="date"
                    {...register("issuedDate")}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.issuedDate && (
                    <p className="text-rose-600 text-xs mt-1">{errors.issuedDate.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Credential ID (Optional)
                  </label>
                  <input
                    {...register("credentialId")}
                    placeholder="e.g. CERT-9821038"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.credentialId && (
                    <p className="text-rose-600 text-xs mt-1">{errors.credentialId.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Verification Link (Optional)
                  </label>
                  <input
                    {...register("verificationUrl")}
                    placeholder="https://credly.com/..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.verificationUrl && (
                    <p className="text-rose-600 text-xs mt-1">{errors.verificationUrl.message}</p>
                  )}
                </div>
              </div>

              {/* PDF & Image Upload with Interactive Signature Redaction Tool */}
              <SignatureRedactionTool
                initialImageUrl={currentImageUrl}
                initialPdfUrl={watch("pdfUrl")}
                initialBlurData={watch("blurData")}
                onUploadComplete={(result) => {
                  setValue("imageUrl", result.imageUrl, { shouldValidate: true });
                  if (result.pdfUrl) setValue("pdfUrl", result.pdfUrl);
                  if (result.blurData) setValue("blurData", result.blurData);
                }}
              />

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Certificate Image or Thumbnail URL (Optional)
                </label>
                <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
                  <input
                    {...register("imageUrl")}
                    placeholder="/certificates/cert-01.png or https://..."
                    className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {currentImageUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(currentImageUrl)}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold whitespace-nowrap transition-colors"
                    >
                      Preview Image
                    </button>
                  )}
                  {watch("pdfUrl") && (
                    <button
                      type="button"
                      onClick={() => setPreviewPdfUrl(watch("pdfUrl")!)}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold whitespace-nowrap transition-colors border border-rose-200 flex items-center gap-1.5"
                    >
                      <span>📄 Preview PDF Pages</span>
                    </button>
                  )}
                </div>
                {errors.imageUrl && (
                  <p className="text-rose-600 text-xs mt-1">{errors.imageUrl.message}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Optional. Auto-populated when uploading via the Redaction Tool above, or enter manually.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Description / Topics Covered (Optional)
                </label>
                <textarea
                  {...register("description")}
                  rows={2}
                  placeholder="Key competencies, covered domains, or honors..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                {errors.description && (
                  <p className="text-rose-600 text-xs mt-1">{errors.description.message}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("published")}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Published (Visible on portfolio)
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("featured")}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Featured (Showcased on Home page)
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-md shadow-indigo-500/20"
                >
                  {isSubmitting ? "Saving..." : editingId ? "Update Certificate" : "Create Certificate"}
                </button>
              </div>
            </form>
          )}

          {/* Certificate Items List */}
          {items.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200/80 shadow-sm">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-800">No certificates added yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Click &quot;+ New Certificate&quot; to add your certifications, licenses, or course completions.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-4 px-6">Certificate &amp; Issuer</th>
                      <th className="py-4 px-4">Issued Date</th>
                      <th className="py-4 px-4">Credential ID</th>
                      <th className="py-4 px-4 text-center">Featured</th>
                      <th className="py-4 px-4 text-center">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3.5">
                            {c.imageUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreviewImage(c.imageUrl)}
                                className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 bg-slate-50 hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={c.imageUrl}
                                  alt={c.title}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ) : c.pdfUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreviewPdfUrl(c.pdfUrl)}
                                title="Click to preview and scroll PDF pages"
                                className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 flex flex-col items-center justify-center flex-shrink-0 transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <span className="text-[9px] font-bold mt-0.5">PDF</span>
                              </button>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900 line-clamp-1">{c.title}</p>
                                {c.blurData && (
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                                    🔒 Redacted
                                  </span>
                                )}
                                {c.pdfUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewPdfUrl(c.pdfUrl)}
                                    className="text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 whitespace-nowrap cursor-pointer transition-colors"
                                    title="Click to preview and scroll PDF pages"
                                  >
                                    📄 PDF Pages
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-indigo-600 font-semibold">{c.issuer}</p>
                              {c.description && (
                                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                                  {c.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap text-slate-600 text-xs font-medium">
                          {formatDateDisplay(c.issuedDate)}
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-500">
                          {c.credentialId ? (
                            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono text-[11px]">
                              {c.credentialId}
                            </code>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => onToggleField(c.id, "featured", c.featured)}
                            title={c.featured ? "Click to unfeature" : "Click to feature"}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                              c.featured
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {c.featured ? "★ Featured" : "Standard"}
                          </button>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => onToggleField(c.id, "published", c.published)}
                            title={c.published ? "Click to unpublish" : "Click to publish"}
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                              c.published
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                c.published ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {c.published ? "Published" : "Draft"}
                          </button>
                        </td>

                        <td className="py-4 px-6 text-right whitespace-nowrap space-x-2">
                          {c.verificationUrl && (
                            <a
                              href={c.verificationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors inline-block"
                            >
                              Verify ↗
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(c)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Image Lightbox Preview Modal */}
          {previewImage && (
            <div
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setPreviewImage(null)}
            >
              <div
                className="relative max-w-6xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
                <img
                  src={previewImage}
                  alt="Certificate Preview"
                  className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
                />
              </div>
            </div>
          )}

          {/* Multi-Page PDF Scroll Preview Modal */}
          {previewPdfUrl && (
            <PdfScrollModal
              pdfUrl={previewPdfUrl}
              onClose={() => setPreviewPdfUrl(null)}
            />
          )}
        </main>
      </div>
    </>
  );
}

function PdfScrollModal({
  pdfUrl,
  onClose,
}: {
  pdfUrl: string;
  onClose: () => void;
}) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const renderAllPages = async () => {
      try {
        setLoading(true);
        setError(null);

        let pdfjs = (window as unknown as { pdfjsLib?: any }).pdfjsLib;
        if (!pdfjs) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            script.onload = () => {
              const lib = (window as unknown as { pdfjsLib: any }).pdfjsLib;
              lib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
              pdfjs = lib;
              resolve();
            };
            script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
            document.body.appendChild(script);
          });
        }

        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;
        const rendered: string[] = [];

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        for (let p = 1; p <= pdfDoc.numPages; p++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(p);
          const viewport = page.getViewport({ scale: 1.5 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          rendered.push(canvas.toDataURL("image/jpeg", 0.9));
        }

        if (!cancelled) {
          setPages(rendered);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load PDF document");
          setLoading(false);
        }
      }
    };

    renderAllPages();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[92vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800">
              📄 Multi-Page Document Preview
            </span>
            {pages.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {pages.length} {pages.length === 1 ? "Page" : "Pages"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-1"
            >
              <span>Open raw PDF ↗</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-100">
          {loading && (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading and rendering document pages...</p>
            </div>
          )}

          {error && (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
              <p className="font-bold">Could not render PDF preview</p>
              <p className="text-xs mt-1">{error}</p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500"
              >
                Open directly in new tab
              </a>
            </div>
          )}

          {!loading && !error && pages.map((pageDataUrl, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden"
            >
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Page {idx + 1} of {pages.length}</span>
              </div>
              <div className="p-4 flex justify-center bg-slate-50/50">
                <img
                  src={pageDataUrl}
                  alt={`Document Page ${idx + 1}`}
                  className="max-w-full h-auto rounded shadow-sm border border-slate-200"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

