import { useState } from 'react';
import Head from 'next/head';
import { AdminSidebar } from '@/components/AdminSidebar';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/withAdmin';
import { getCached } from '@/lib/cache';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const formSchema = z.object({
  fullName: z.string().trim().min(1, 'Full Name is required'),
  role: z.string().trim().min(1, 'Role is required'),
  location: z.string().trim().min(1, 'Work Location is required'),
  bio: z.string().trim().optional(),
  available: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

export interface ProfileData {
  id: number;
  fullName: string;
  role: string;
  location: string;
  bio: string | null;
  available: boolean;
}

export const getServerSideProps = withAdmin<{ profile: ProfileData }>(async () => {
  const profile = await getCached('profile:data', 30, async () => {
    let row = await prisma.profile.findFirst({
      orderBy: { id: 'asc' },
    });

    if (!row) {
      row = await prisma.profile.create({
        data: {
          fullName: 'Jerry Cajote',
          role: 'Full Stack Developer',
          location: 'Available Globally (Remote)',
          bio: 'I build robust, high-performance web applications from database schemas to polished, responsive, and animated user experiences.',
          available: true,
        },
      });
    }

    return {
      id: row.id,
      fullName: row.fullName,
      role: row.role,
      location: row.location,
      bio: row.bio,
      available: row.available,
    };
  });

  return {
    props: {
      profile,
    },
  };
});

export default function AdminProfile({ profile }: { profile: ProfileData }) {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: profile.fullName,
      role: profile.role,
      location: profile.location,
      bio: profile.bio ?? '',
      available: profile.available,
    },
  });

  // Watch inputs for the live preview cards
  const currentRole = watch('role') || 'Full Stack Developer';
  const currentLocation = watch('location') || 'Available Globally (Remote)';
  const currentFullName = watch('fullName') || 'Jerry Cajote';
  const isAvailable = watch('available');

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setServerError(body.error ?? 'Failed to update profile.');
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      setServerError('An unexpected error occurred while saving.');
    }
  };

  return (
    <>
      <Head>
        <title>Profile &amp; Work Location – Portfolio Admin</title>
      </Head>

      <div className="flex flex-col md:flex-row min-h-screen bg-slate-100">
        <AdminSidebar />

        <main className="flex-1 p-6 sm:p-8 lg:p-10 w-full min-w-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Profile &amp; Work Location
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Customize the role, location status, and headline displayed across your public portfolio.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Edit Form */}
            <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200/80">
              <h2 className="text-xl font-bold text-slate-900 pb-3 border-b border-slate-100 mb-6 flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </span>
                <span>Edit Profile Details</span>
              </h2>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    {...register('fullName')}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {errors.fullName && (
                    <p className="text-rose-600 text-xs mt-1">{errors.fullName.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Role / Professional Title
                    </label>
                    <input
                      {...register('role')}
                      placeholder="e.g. Full Stack Developer"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    {errors.role && (
                      <p className="text-rose-600 text-xs mt-1">{errors.role.message}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Appears on the homepage hero, about page, and cards.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Work Location
                    </label>
                    <input
                      {...register('location')}
                      placeholder="e.g. Available Globally (Remote)"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    {errors.location && (
                      <p className="text-rose-600 text-xs mt-1">{errors.location.message}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Displayed in the Location highlight box.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    About / Bio Summary
                  </label>
                  <textarea
                    {...register('bio')}
                    rows={4}
                    placeholder="Short introduction or summary..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all leading-relaxed"
                  />
                  {errors.bio && (
                    <p className="text-rose-600 text-xs mt-1">{errors.bio.message}</p>
                  )}
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      {...register('available')}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Available for new projects &amp; full-time opportunities</span>
                  </label>
                </div>

                {serverError && (
                  <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                    {serverError}
                  </div>
                )}

                {saveSuccess && (
                  <div role="status" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Profile settings updated successfully! Changes reflect on the public site immediately.</span>
                  </div>
                )}

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all duration-200"
                  >
                    {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Live Visual Preview */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 text-white p-6 sm:p-7 rounded-2xl shadow-xl border border-slate-800">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-5">
                  <span className="text-xs uppercase tracking-wider font-bold text-indigo-400">
                    Live Public Preview
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-4">
                  This matches the exact visual appearance displayed on your public <code className="text-indigo-300">/</code> homepage:
                </p>

                {/* Exact cards matching the user screenshot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Role Card */}
                  <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-md">
                    <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold font-mono">
                      ROLE
                    </p>
                    <p className="text-base font-bold text-white mt-1 break-words">
                      {currentRole}
                    </p>
                  </div>

                  {/* Location Card */}
                  <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-md">
                    <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold font-mono">
                      LOCATION
                    </p>
                    <p className="text-base font-bold text-white mt-1 break-words">
                      {currentLocation}
                    </p>
                  </div>
                </div>

                {/* Preview CTA Buttons */}
                <div className="mt-5 pt-4 border-t border-slate-800 flex items-center gap-3">
                  <span className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow">
                    Browse Projects
                  </span>
                  <span className="px-4 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-semibold">
                    Let&apos;s Connect
                  </span>
                </div>

                {/* Hero Badge Preview */}
                <div className="mt-5 p-3 rounded-xl bg-slate-800/50 border border-slate-700/40 text-xs">
                  <p className="text-slate-400 text-[11px] mb-1 font-semibold">Homepage Status Pill:</p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/70 border border-indigo-800 text-indigo-300 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{currentRole}</span>
                  </div>
                </div>
              </div>

              {/* Quick Info Box */}
              <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-5 text-indigo-950 text-sm leading-relaxed">
                <p className="font-bold flex items-center gap-2 mb-1.5 text-indigo-900">
                  <span>💡 Instant Update</span>
                </p>
                <p className="text-xs text-indigo-800">
                  Updating your <strong>Role</strong> and <strong>Work Location</strong> here instantly refreshes the public About Me section, Home hero titles, and metadata without needing code changes or rebuilds.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

