"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OnboardingProgress from "@/components/onboarding-progress";

const providers = [
  {
    id: "instagram",
    name: "Instagram",
    icon: "◎",
    description: "Analyze your Instagram presence and content.",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "f",
    description: "Connect your Facebook presence.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "♪",
    description: "Connect TikTok for short-form content insights.",
  },
  {
    id: "email",
    name: "Email",
    icon: "✉",
    description: "Connect your email marketing platform.",
  },
];

export default function ChannelsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [connected, setConnected] = useState<string[]>([]);
  const [brandId, setBrandId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data: brand } = await supabase
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!brand) return;

      setBrandId(brand.id);

      const { data } = await supabase
        .from("channel_connections")
        .select("provider")
        .eq("brand_id", brand.id);

      setConnected((data || []).map((x) => x.provider));
    }

    load();
  }, []);

  async function handleContinue() {
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_step: 12 })
        .eq("id", user.id);
    }

    router.push("/onboarding/documents");
  }

  async function addChannel(provider: string) {
    if (connected.includes(provider)) return;

    const { error } = await supabase
      .from("channel_connections")
      .insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        brand_id: brandId,
        provider,
        status: "pending",
      });

    if (!error) {
      setConnected((current) => [...current, provider]);
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <OnboardingProgress step={11} />
        <section className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">
          Step 11
        </p>

        <h1 className="mt-3 text-4xl font-bold">Connect your channels</h1>

        <p className="mt-3 mb-10 text-gray-500">
          Connect the platforms your brand uses for marketing.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {providers.map((provider) => {
            const isConnected = connected.includes(provider.id);

            return (
              <div
                key={provider.id}
                className="rounded-2xl border border-[#e8d4f1] p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8d4f1] text-xl font-bold">
                    {provider.icon}
                  </div>

                  {isConnected && (
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                      Added
                    </span>
                  )}
                </div>

                <h2 className="mt-5 font-semibold">{provider.name}</h2>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {provider.description}
                </p>

                <button
                  onClick={() => addChannel(provider.id)}
                  disabled={isConnected}
                  className="mt-5 w-full rounded-xl border border-[#e8d4f1] px-4 py-3 text-sm font-semibold hover:bg-[#faf7fc] disabled:opacity-50"
                >
                  {isConnected ? "Added" : "Connect"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl bg-[#faf7fc] p-4 text-sm text-gray-500">
          OAuth connections will be implemented in the backend. For now,
          this page records which channels the brand wants to use.
        </div>

        <div className="mt-8 flex justify-between border-t border-[#e8d4f1] pt-7">
          <button
            onClick={() => router.push("/onboarding/tables")}
            className="rounded-xl px-5 py-3 text-sm text-gray-500"
          >
            ← Back
          </button>

          <button
            onClick={handleContinue}
            disabled={saving}
            className="rounded-xl bg-[#2a073c] px-7 py-3.5 font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Continue →"}
          </button>
        </div>
          </div>
        </section>
      </div>
    </main>
  );
}