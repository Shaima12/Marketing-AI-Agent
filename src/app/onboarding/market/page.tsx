"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MarketPage() {
  const router = useRouter();
  const supabase = createClient();

  const [brandId, setBrandId] = useState("");
  const [industry, setIndustry] = useState("");
  const [market, setMarket] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [position, setPosition] = useState("");
  const [trends, setTrends] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data } = await supabase
        .from("brands")
        .select("id, market")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!data) {
        setError("Brand not found.");
        setLoading(false);
        return;
      }

      setBrandId(data.id);

      const value = data.market || {};

      setIndustry(value.industry || "");
      setMarket(value.market || "");
      setCompetitors(value.competitors || "");
      setPosition(value.position || "");
      setTrends(value.trends || "");

      setLoading(false);
    }

    load();
  }, []);

  async function handleContinue() {
    setSaving(true);
    setError("");

    const { error } = await supabase
      .from("brands")
      .update({
        market: {
          industry: industry.trim(),
          market: market.trim(),
          competitors: competitors.trim(),
          position: position.trim(),
          trends: trends.trim(),
        },
      })
      .eq("id", brandId);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_step: 6 })
        .eq("id", user.id);
    }

    router.push("/onboarding/marketing");
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <Layout step={5} title="Understand your market"
      subtitle="Give your AI context about the market your brand operates in.">

      <Field
        label="What industry or category are you in?"
        placeholder="Example: Fashion, beauty, SaaS, food & beverage..."
        value={industry}
        onChange={setIndustry}
      />

      <Field
        label="What market do you operate in?"
        placeholder="Example: Tunisia, North Africa, European fashion market..."
        value={market}
        onChange={setMarket}
      />

      <Field
        label="Who are your main competitors?"
        placeholder="List your main direct or indirect competitors..."
        value={competitors}
        onChange={setCompetitors}
      />

      <Field
        label="How do you want to be positioned in the market?"
        placeholder="Example: Accessible premium contemporary fashion..."
        value={position}
        onChange={setPosition}
      />

      <Field
        label="What market trends matter to your brand?"
        placeholder="Describe trends, changes or opportunities you are watching..."
        value={trends}
        onChange={setTrends}
      />

      <Actions
        back="/onboarding/brand-voice"
        onContinue={handleContinue}
        saving={saving}
        error={error}
      />
    </Layout>
  );
}

function Field({ label, placeholder, value, onChange }: any) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-[#e8d4f1] px-4 py-3.5 text-sm outline-none focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]"
      />
    </div>
  );
}

function Actions({ back, onContinue, saving, error }: any) {
  const router = useRouter();

  return (
    <>
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex justify-between border-t border-[#e8d4f1] pt-7">
        <button
          onClick={() => router.push(back)}
          className="rounded-xl px-5 py-3 text-sm text-gray-500 hover:bg-gray-100"
        >
          ← Back
        </button>

        <button
          onClick={onContinue}
          disabled={saving}
          className="rounded-xl bg-[#2a073c] px-7 py-3.5 font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Continue →"}
        </button>
      </div>
    </>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
      Loading...
    </div>
  );
}

function Layout({ step, title, subtitle, children }: any) {
  const steps = [
    "Brand Basics",
    "Positioning",
    "Customer",
    "Brand Voice",
    "Market",
    "Marketing",
    "Constraints",
    "Measurement",
    "Business Data",
    "Table Permissions",
    "Channels",
    "Documents",
    "Review",
  ];

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-[#e8d4f1] bg-[#faf7fc] p-8 lg:block">
          <div className="mb-10 text-2xl font-bold">
            Marketing<span className="text-[#b57fdc]">AI</span>
          </div>

          <div className="space-y-2">
            {steps.map((name, i) => (
              <div
                key={name}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  i + 1 === step ? "bg-[#e8d4f1]" : ""
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    i + 1 < step
                      ? "bg-[#b57fdc] text-white"
                      : i + 1 === step
                      ? "bg-[#2a073c] text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i + 1 < step ? "✓" : i + 1}
                </div>
                <span className="text-sm">{name}</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">
              Step {String(step).padStart(2, "0")}
            </p>

            <h1 className="text-4xl font-bold">{title}</h1>

            <p className="mt-3 mb-10 text-gray-500">{subtitle}</p>

            <div className="space-y-7">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}