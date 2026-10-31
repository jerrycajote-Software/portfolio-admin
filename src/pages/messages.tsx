import { AdminSidebar } from "@/components/AdminSidebar";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/withAdmin";

export const getServerSideProps = withAdmin(async () => {
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  return {
    props: {
      messages: JSON.parse(JSON.stringify(messages)),
    },
  };
});

export default function Messages({ messages }: any) {
  const toggleRead = async (id: number, read: boolean) => {
    await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: !read }),
    });
    window.location.reload();
  };

  const deleteMessage = async (id: number) => {
    if (!window.confirm("Delete this message? This cannot be undone.")) return;
    await fetch(`/api/messages/${id}`, { method: "DELETE" });
    window.location.reload();
  };

  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 p-8 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold mb-8">Contact Messages</h1>
        <div className="space-y-4">
          {messages.map((msg: any) => (
            <div
              key={msg.id}
              className={`bg-white p-6 rounded-lg shadow ${
                !msg.read ? "border-l-4 border-indigo-500" : ""
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{msg.name}</h3>
                  <p className="text-gray-500 text-sm">{msg.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm">
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => toggleRead(msg.id, msg.read)}
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      msg.read
                        ? "bg-gray-100 text-gray-600"
                        : "bg-indigo-100 text-indigo-800"
                    }`}
                  >
                    {msg.read ? "Mark Unread" : "Mark Read"}
                  </button>
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    className="px-3 py-1 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-3 text-gray-700">{msg.message}</p>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-center text-gray-500 py-8">No messages yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
