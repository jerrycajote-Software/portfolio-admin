import { AdminSidebar } from "@/components/AdminSidebar";
import { prisma } from "@/lib/prisma";

export async function getServerSideProps() {
  const [projectCount, messageCount, skillCount, blogCount] = await Promise.all([
    prisma.project.count(),
    prisma.contactMessage.count({ where: { read: false } }),
    prisma.skill.count(),
    prisma.blogPost.count(),
  ]);

  return {
    props: { projectCount, messageCount, skillCount, blogCount },
  };
}

interface DashboardProps {
  projectCount: number;
  messageCount: number;
  skillCount: number;
  blogCount: number;
}

export default function Dashboard({
  projectCount,
  messageCount,
  skillCount,
  blogCount,
}: DashboardProps) {
  const stats = [
    { label: "Projects", value: projectCount, color: "bg-indigo-500" },
    { label: "Unread Messages", value: messageCount, color: "bg-red-500" },
    { label: "Skills", value: skillCount, color: "bg-emerald-500" },
    { label: "Blog Posts", value: blogCount, color: "bg-amber-500" },
  ];

  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-lg shadow p-6 border-l-4"
              style={{ borderLeftColor: "inherit" }}
            >
              <div className={`inline-block px-3 py-1 rounded text-white text-xs font-semibold ${stat.color} mb-2`}>
                {stat.label}
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
