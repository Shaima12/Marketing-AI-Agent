"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "⌂" },
  { href: "/dashboard/brand", label: "Brand", icon: "◈" },
  { href: "/dashboard/assistant", label: "Assistant", icon: "✦" },
  { href: "/dashboard/profile", label: "Profile", icon: "○" },
];

export default function DashboardShell({
  children,
  userId,
  fullName,
  email,
  brandName,
}: {
  children: ReactNode;
  userId: string;
  fullName: string;
  email: string;
  brandName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === href
      : pathname.startsWith(href);
  }

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#292437] lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-[#251d31] px-5 py-6 text-white lg:flex">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b57fdc] text-lg text-[#251d31]">
            ✦
          </span>
          <span>
            <span className="block text-sm font-semibold">MarketingAI</span>
            <span className="mt-0.5 block truncate text-xs text-white/55">
              {brandName}
            </span>
          </span>
        </Link>

        <p className="mb-3 mt-12 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          Workspace
        </p>
        <nav className="space-y-1" aria-label="Workspace navigation">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-white/10 font-medium text-white"
                    : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center text-base text-[#d6b6ed]">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-5">
          <Link
            href="/dashboard/profile"
            className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcebd9] text-xs font-semibold text-[#315747]">
              {initials || "U"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {fullName}
              </span>
              <span className="block truncate text-xs text-white/50">
                {email}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 w-full rounded-lg px-3 py-2 text-left text-xs text-white/55 transition hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[#e6e3e8] bg-[#f8f8f5]/95 px-5 py-3 backdrop-blur sm:px-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#251d31] text-sm text-white">
                ✦
              </span>
              <span className="text-sm font-semibold text-[#292437]">
                MarketingAI
              </span>
            </Link>
            <p className="hidden text-xs font-medium text-[#77717f] lg:block">
              {brandName} <span className="px-1.5 text-[#c1bbc7]">/</span>
              <span className="text-[#292437]">
                {navigation.find((item) => isActive(item.href))?.label || "Workspace"}
              </span>
            </p>
            <Link
              href="/dashboard/profile"
              aria-label={`Profile for ${fullName}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcebd9] text-xs font-semibold text-[#315747] lg:hidden"
            >
              {initials || "U"}
            </Link>
            <Link
              href="/dashboard/assistant"
              className="hidden items-center gap-2 rounded-lg bg-[#251d31] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#3b3048] sm:flex"
            >
              <span className="text-[#d6b6ed]">✦</span>
              Ask your assistant
            </Link>
          </div>
          <nav
            className="mt-3 flex gap-1 overflow-x-auto lg:hidden"
            aria-label="Workspace navigation"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs ${
                  isActive(item.href)
                    ? "bg-[#e8d4f1] font-semibold text-[#2a073c]"
                    : "text-[#77717f]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="w-full flex-1 px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
      <span className="sr-only">Account {userId}</span>
    </div>
  );
}