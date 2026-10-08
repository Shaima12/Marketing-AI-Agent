"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // If email confirmation is disabled,
    // Supabase should create a session immediately.
    if (data.session) {
      window.location.href = "/onboarding";
      return;
    }

    // Fallback in case email confirmation is enabled.
    setMessage(
      "Account created. Please check your email to confirm your account."
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left visual section */}
        <section className="relative hidden overflow-hidden bg-[#2a073c] lg:flex">
          <div className="absolute inset-0">
            <div className="absolute left-[-100px] top-[-100px] h-80 w-80 rounded-full bg-[#b57fdc] opacity-30 blur-3xl" />
            <div className="absolute bottom-[-100px] right-[-100px] h-96 w-96 rounded-full bg-[#cba5ea] opacity-20 blur-3xl" />
          </div>

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
            <Link href="/" className="text-2xl font-bold text-white">
              Marketing<span className="text-[#cba5ea]">AI</span>
            </Link>

            <div className="max-w-lg">
              <div className="mb-6 inline-flex rounded-full border border-[#cba5ea]/30 bg-white/10 px-4 py-2 text-sm text-[#e8d4f1]">
                ✦ AI-powered marketing intelligence
              </div>

              <h1 className="text-5xl font-bold leading-tight text-white xl:text-6xl">
                Your brand.
                <br />
                Your data.
                <br />
                <span className="text-[#b57fdc]">Your AI.</span>
              </h1>

              <p className="mt-6 max-w-md text-lg leading-8 text-[#e8d4f1]">
                Build a marketing intelligence system that understands your
                brand, analyzes your data, researches the market, and helps you
                make better decisions.
              </p>

              <div className="mt-10 grid grid-cols-2 gap-4">
                {[
                  ["✦", "Brand intelligence"],
                  ["◉", "Business analytics"],
                  ["⌁", "Market research"],
                  ["◎", "AI insights"],
                ].map(([icon, text]) => (
                  <div
                    key={text}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                  >
                    <div className="text-xl text-[#cba5ea]">{icon}</div>

                    <p className="mt-2 text-sm font-medium text-white">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm text-[#e8d4f1]/60">
              Marketing intelligence, built for real brands.
            </p>
          </div>
        </section>

        {/* Form section */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="mb-10 lg:hidden">
              <Link href="/" className="text-2xl font-bold text-[#2a073c]">
                Marketing<span className="text-[#b57fdc]">AI</span>
              </Link>
            </div>

            {/* Heading */}
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">
                Get started
              </p>

              <h2 className="text-4xl font-bold tracking-tight text-[#2a073c]">
                Create your account
              </h2>

              <p className="mt-3 text-gray-500">
                Start building your marketing intelligence system.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {/* Full name */}
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium text-[#2a073c]"
                >
                  Full name
                </label>

                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-[#e8d4f1] bg-white px-4 py-3.5 outline-none transition focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]"
                />
              </div>

              {/* Email */}
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

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-[#2a073c]"
                >
                  Password
                </label>

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

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium text-[#2a073c]"
                >
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#e8d4f1] bg-white px-4 py-3.5 outline-none transition focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Message */}
              {message && (
                <div className="rounded-xl border border-[#cba5ea] bg-[#e8d4f1]/50 px-4 py-3 text-sm text-[#2a073c]">
                  {message}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#2a073c] px-5 py-3.5 font-semibold text-white transition hover:bg-[#3d1055] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            {/* Sign in */}
            <p className="mt-8 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="font-semibold text-[#b57fdc] hover:text-[#2a073c]"
              >
                Sign in
              </Link>
            </p>

            <p className="mt-8 text-center text-xs leading-5 text-gray-400">
              By creating an account, you agree to our terms and privacy
              policy.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}