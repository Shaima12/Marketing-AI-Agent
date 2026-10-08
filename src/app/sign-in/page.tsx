"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle()
      : { data: null };

    window.location.href = profile?.onboarding_completed
      ? "/dashboard"
      : "/onboarding";
  }

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left visual section */}
        <section className="relative hidden overflow-hidden bg-[#2a073c] lg:flex">
          <div className="absolute inset-0">
            <div className="absolute right-[-120px] top-[-100px] h-96 w-96 rounded-full bg-[#b57fdc] opacity-30 blur-3xl" />
            <div className="absolute bottom-[-120px] left-[-100px] h-96 w-96 rounded-full bg-[#cba5ea] opacity-20 blur-3xl" />
          </div>

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
            <Link href="/" className="text-2xl font-bold text-white">
              Marketing<span className="text-[#cba5ea]">AI</span>
            </Link>

            <div className="max-w-lg">
              <div className="mb-6 flex items-center gap-3">
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#b57fdc]" />
                <span className="text-sm text-[#e8d4f1]">
                  Marketing intelligence is active
                </span>
              </div>

              <h1 className="text-5xl font-bold leading-tight text-white xl:text-6xl">
                Turn your
                <br />
                marketing data
                <br />
                into <span className="text-[#b57fdc]">action.</span>
              </h1>

              <p className="mt-6 max-w-md text-lg leading-8 text-[#e8d4f1]">
                Your AI marketing assistant connects your brand context,
                business data, knowledge, and market research into one
                intelligent system.
              </p>

              <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[#cba5ea]">
                      Intelligence
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      Ready to analyze
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#b57fdc]/20 px-4 py-3 text-2xl">
                    ✦
                  </div>
                </div>

                <div className="mt-5 flex items-end gap-2">
                  {[35, 55, 42, 70, 58, 82, 68, 94].map((height, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-t-lg bg-[#cba5ea]"
                      style={{ height: `${height}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-sm text-[#e8d4f1]/60">
              From data to decisions.
            </p>
          </div>
        </section>

        {/* Form section */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <Link href="/" className="text-2xl font-bold text-[#2a073c]">
                Marketing<span className="text-[#b57fdc]">AI</span>
              </Link>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">
                Welcome back
              </p>

              <h2 className="text-4xl font-bold tracking-tight text-[#2a073c]">
                Sign in
              </h2>

              <p className="mt-3 text-gray-500">
                Continue to your marketing intelligence platform.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-[#2a073c]"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-[#e8d4f1] bg-white px-4 py-3.5 outline-none transition focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-[#2a073c]"
                  >
                    Password
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-[#b57fdc] hover:text-[#2a073c]"
                  >
                    Forgot password?
                  </Link>
                </div>

                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#e8d4f1] bg-white px-4 py-3.5 outline-none transition focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#2a073c] px-5 py-3.5 font-semibold text-white transition hover:bg-[#3d1055] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-[#e8d4f1]" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="h-px flex-1 bg-[#e8d4f1]" />
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#e8d4f1] bg-white px-5 py-3.5 font-medium text-[#2a073c] transition hover:bg-[#e8d4f1]/30"
            >
              <span className="text-lg">G</span>
              Continue with Google
            </button>

            <p className="mt-8 text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="font-semibold text-[#b57fdc] hover:text-[#2a073c]"
              >
                Create account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}