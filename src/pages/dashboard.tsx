import Head from 'next/head';
import Link from 'next/link';
import { AdminSidebar } from '@/components/AdminSidebar';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/withAdmin';

export const getServerSideProps = withAdmin(async () => {
  const [projectCount, messageCount, skillCount, blogCount, certificateCount, profile] = await Promise.all([
    prisma.project.count(),
    prisma.contactMessage.count({ where: { read: false } }),
    prisma.skill.count(),
    prisma.blogPost.count(),
    prisma.certificate?.count ? prisma.certificate.count() : 0,
    prisma.profile.findFirst({ orderBy: { id: 'asc' } }),
  ]);

  return {
    props: {
      projectCount,
      messageCount,
      skillCount,
      blogCount,
      certificateCount,
      profileRole: profile?.role ?? 'Full Stack Developer',
      profileLocation: profile?.location ?? 'Available Globally (Remote)',
      profileAvailable: profile?.available ?? true,
    },
  };
});

interface DashboardProps {
  projectCount: number;
  messageCount: number;
  skillCount: number;
  blogCount: number;
  certificateCount: number;
  profileRole: string;
  profileLocation: string;
  profileAvailable: boolean;
}

export default function Dashboard({
  projectCount,
  messageCount,
  skillCount,
  blogCount,
  certificateCount,
  profileRole,
  profileLocation,
  profileAvailable,
}: DashboardProps) {
  const stats = [
    {
      label: 'Total Projects',
      value: projectCount,
      href: '/projects',
      gradient: 'from-blue-500 to-indigo-600',
      badge: 'bg-indigo-50 text-indigo-700',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      label: 'Certificates',
      value: certificateCount,
      href: '/certificates',
      gradient: 'from-violet-500 to-purple-600',
      badge: 'bg-purple-50 text-purple-700',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
        </svg>
      ),
    },
    {
      label: 'Unread Messages',
      value: messageCount,
      href: '/messages',
      gradient: 'from-rose-500 to-pink-600',
      badge: 'bg-rose-50 text-rose-700',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Active Skills',
      value: skillCount,
      href: '/skills',
      gradient: 'from-emerald-500 to-teal-600',
      badge: 'bg-emerald-50 text-emerald-700',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
    },
    {
      label: 'Published Posts',
      value: blogCount,
      href: '/blog',
      gradient: 'from-amber-500 to-orange-600',
      badge: 'bg-amber-50 text-amber-700',
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <Head>
        <title>Dashboard – Portfolio Admin</title>
      </Head>

      <div className="flex flex-col md:flex-row min-h-screen bg-slate-100">
        <AdminSidebar />

        <main className="flex-1 p-6 sm:p-8 lg:p-10 w-full min-w-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Dashboard Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Welcome back to your portfolio control center.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="group block p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${stat.gradient} flex items-center justify-center shadow-md`}>
                    {stat.icon}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${stat.badge}`}>
                    Manage &rarr;
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">{stat.value}</p>
              </Link>
            ))}
          </div>

          {/* Current Role & Work Location Overview Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-sm mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Public Role &amp; Work Location Status</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Currently displayed live on your portfolio homepage and about section
                </p>
              </div>
              <Link
                href="/profile"
                className="self-start sm:self-auto px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200/80 transition-colors flex items-center gap-1.5"
              >
                <span>Edit Role &amp; Location</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Role
                </p>
                <p className="text-base font-bold text-slate-900 mt-1">
                  {profileRole}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Work Location
                </p>
                <p className="text-base font-bold text-slate-900 mt-1">
                  {profileLocation}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts Section */}
          <div className="rounded-2xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Shortcuts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              <Link
                href="/profile"
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  ✎
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Role &amp; Location</p>
                  <p className="text-xs text-slate-500">Edit profile info</p>
                </div>
              </Link>

              <Link
                href="/projects"
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  +
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Add Project</p>
                  <p className="text-xs text-slate-500">Create or upload</p>
                </div>
              </Link>

              <Link
                href="/certificates"
                className="p-4 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/30 transition-all flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  +
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Add Certificate</p>
                  <p className="text-xs text-slate-500">Add credentials</p>
                </div>
              </Link>

              <Link
                href="/skills"
                className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  +
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Add Skill</p>
                  <p className="text-xs text-slate-500">Stack proficiencies</p>
                </div>
              </Link>

              <Link
                href="/blog"
                className="p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/30 transition-all flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  +
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Write Post</p>
                  <p className="text-xs text-slate-500">Publish articles</p>
                </div>
              </Link>

              <Link
                href="/messages"
                className="p-4 rounded-xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50/30 transition-all flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  ✉
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Messages</p>
                  <p className="text-xs text-slate-500">View inquiries</p>
                </div>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
