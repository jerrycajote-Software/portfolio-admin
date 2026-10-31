import { useState, type FormEvent } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { signIn } from "next-auth/react";

// Only allow redirects back into this app (prevents open redirects).
function safeCallbackUrl(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });

    setLoading(false);
    if (!res || res.error) {
      setError("Invalid email or password.");
      return;
    }
    // Full navigation so the proxy and getServerSideProps see the new cookie.
    window.location.href = safeCallbackUrl(router.query.callbackUrl);
  };

  return (
    <>
      <Head>
        <title>Sign in – Portfolio Admin</title>
      </Head>
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-8 rounded-lg shadow space-y-4">
          <h1 className="text-2xl font-bold">Portfolio Admin</h1>
          <p className="text-sm text-gray-600">Sign in to manage your portfolio.</p>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="w-full p-2 border rounded" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full p-2 border rounded" />
          </div>

          {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    </>
  );
}

