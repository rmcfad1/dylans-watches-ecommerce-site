import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Watch } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const dest = (formData.get("from") as string) || "/";
    if (
      process.env.ADMIN_USERNAME &&
      process.env.ADMIN_PASSWORD &&
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      (await cookies()).set("admin-session", process.env.ADMIN_SECRET!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
      redirect(dest);
    }
    const params = new URLSearchParams({ error: "1" });
    if (dest !== "/") params.set("from", dest);
    redirect(`/login?${params}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <Watch className="w-6 h-6 text-amber-500" />
          <div>
            <p className="font-bold text-gray-900 text-sm">Dylan&apos;s Watches</p>
            <p className="text-xs text-gray-400">Admin</p>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your admin password to continue.</p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
            Incorrect password — try again.
          </p>
        )}

        <form action={login} className="space-y-4">
          <input type="hidden" name="from" value={from ?? ""} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="username"
              autoFocus
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
