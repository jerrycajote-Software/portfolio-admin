import { useState, useEffect } from 'react';
import Head from 'next/head';
import { AdminSidebar } from '@/components/AdminSidebar';
import { prisma } from '@/lib/prisma';
import { withAdmin } from '@/lib/withAdmin';
import { getCached } from '@/lib/cache';

export const getServerSideProps = withAdmin(async () => {
  const messages = await getCached('messages:list', 15, async () => {
    const raw = await prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return JSON.parse(JSON.stringify(raw));
  });

  return {
    props: {
      messages,
    },
  };
});

interface MessageItem {
  id: number;
  name: string;
  email: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function Messages({ messages }: { messages: MessageItem[] }) {
  const [messageList, setMessageList] = useState<MessageItem[]>(messages);

  useEffect(() => {
    setMessageList(messages);
  }, [messages]);

  const toggleRead = async (id: number, currentRead: boolean) => {
    const nextRead = !currentRead;
    setMessageList((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: nextRead } : m))
    );

    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: nextRead }),
      });
      if (!res.ok) {
        throw new Error('Failed to update message status');
      }
    } catch {
      setMessageList((prev) =>
        prev.map((m) => (m.id === id ? { ...m, read: currentRead } : m))
      );
      window.alert('Failed to update message status. Please try again.');
    }
  };

  const deleteMessage = async (id: number) => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return;

    const previous = messageList;
    setMessageList((prev) => prev.filter((m) => m.id !== id));

    try {
      const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete message');
      }
    } catch {
      setMessageList(previous);
      window.alert('Failed to delete message. Please try again.');
    }
  };

  return (
    <>
      <Head>
        <title>Messages – Portfolio Admin</title>
      </Head>

      <div className="flex flex-col md:flex-row min-h-screen bg-slate-100">
        <AdminSidebar />
        <main className="flex-1 p-6 sm:p-8 lg:p-10 w-full min-w-0">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Contact Messages
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage client inquiries and messages sent via the portfolio contact form.
            </p>
          </div>

          <div className="space-y-4">
            {messageList.map((msg) => (
              <div
                key={msg.id}
                className={`bg-white p-6 rounded-2xl shadow-sm border transition-all ${
                  !msg.read
                    ? 'border-indigo-500 bg-indigo-50/20 shadow-md'
                    : 'border-slate-200/80 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-slate-900">{msg.name}</h3>
                      {!msg.read && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-600 text-white">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5">{msg.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-400 text-xs mr-2">
                      {new Date(msg.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleRead(msg.id, msg.read)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        msg.read
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {msg.read ? 'Mark Unread' : 'Mark as Read'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMessage(msg.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-4 text-slate-700 text-sm leading-relaxed bg-slate-50/60 p-4 rounded-xl border border-slate-100 whitespace-pre-line">
                  {msg.message}
                </p>
              </div>
            ))}

            {messageList.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-500">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="font-semibold text-slate-600">No messages yet</p>
                <p className="text-xs text-slate-400 mt-1">New submissions will show up here automatically.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
