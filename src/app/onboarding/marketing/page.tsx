"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const channels = [
  "Instagram",
  "TikTok",
  "Facebook",
  "Email",
  "Website",
  "LinkedIn",
  "YouTube",
];

const contentTypes = [
  "Educational",
  "Product stories",
  "Customer stories",
  "Short-form video",
  "Influencer content",
  "Promotional",
  "Behind the scenes",
  "Trends",
];

export default function MarketingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [brandId, setBrandId] = useState("");
  const [objectives, setObjectives] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedContent, setSelectedContent] = useState<string[]>([]);
  const [growth, setGrowth] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
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
        .select("id, marketing")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!data) {
        setError("Brand not found.");
        setLoading(false);
        return;
      }

      setBrandId(data.id);

      const value = data.marketing || {};

      setObjectives(value.objectives || "");
      setSelectedChannels(value.channels || []);
      setSelectedContent(value.content_types || []);
      setGrowth(value.growth_priorities || "");

      setLoading(false);
    }

    load();
  }, []);

  function toggle(
    value: string,
    current: string[],
    setter: (value: string[]) => void
  ) {
    setter(
      current.includes(value)
        ? current.filter((x) => x !== value)
        : [...current, value]
    );
  }

  async function handleContinue() {
    setSaving(true);

    const { error } = await supabase
      .from("brands")
      .update({
        marketing: {
          objectives: objectives.trim(),
          channels: selectedChannels,
          content_types: selectedContent,
          growth_priorities: growth.trim(),
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
        .update({ onboarding_step: 7 })
        .eq("id", user.id);
    }

    router.push("/onboarding/constraints");
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <Layout
      step={6}
      title="Define your marketing"
      subtitle="Tell your AI what you want your marketing efforts to achieve."
    >
      <Field
        label="What are your main marketing objectives?"
        placeholder="Example: Increase awareness, grow sales, build community..."
        value={objectives}
        onChange={setObjectives}
      />

      <ChoiceGroup
        label="Which channels do you use?"
        values={channels}
        selected={selectedChannels}
        onToggle={(x: string) =>
          toggle(x, selectedChannels, setSelectedChannels)
        }
      />

      <ChoiceGroup
        label="What content does your brand create?"
        values={contentTypes}
        selected={selectedContent}
        onToggle={(x: string) =>
          toggle(x, selectedContent, setSelectedContent)
        }
      />

      <Field
        label="What are your growth priorities?"
        placeholder="What would you like your marketing to improve?"
        value={growth}
        onChange={setGrowth}
      />

      <Actions
        back="/onboarding/market"
        onContinue={handleContinue}
        saving={saving}
        error={error}
      />
    </Layout>
  );
}

function ChoiceGroup({ label, values, selected, onToggle }: any) {
  return (
    <div>
      <label className="mb-3 block text-sm font-semibold">{label}</label>

      <div className="flex flex-wrap gap-3">
        {values.map((value: string) => (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className={`rounded-full border px-4 py-2 text-sm ${
              selected.includes(value)
                ? "border-[#b57fdc] bg-[#e8d4f1] font-semibold"
                : "border-gray-200 hover:border-[#b57fdc]"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
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
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="flex justify-between border-t border-[#e8d4f1] pt-7">
        <button onClick={() => router.push(back)} className="rounded-xl px-5 py-3 text-sm text-gray-500 hover:bg-gray-100">
          ← Back
        </button>

        <button onClick={onContinue} disabled={saving} className="rounded-xl bg-[#2a073c] px-7 py-3.5 font-semibold text-white disabled:opacity-60">
          {saving ? "Saving..." : "Continue →"}
        </button>
      </div>
    </>
  );
}

function Loading() {
  return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
}

function Layout({ step, title, subtitle, children }: any) {
  const steps = [
    "Brand Basics","Positioning","Customer","Brand Voice","Market",
    "Marketing","Constraints","Measurement","Business Data",
    "Table Permissions","Channels","Documents","Review",
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
              <div key={name} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${i + 1 === step ? "bg-[#e8d4f1]" : ""}`}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i + 1 < step ? "bg-[#b57fdc] text-white" :
                  i + 1 === step ? "bg-[#2a073c] text-white" :
                  "bg-gray-100 text-gray-400"
                }`}>
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