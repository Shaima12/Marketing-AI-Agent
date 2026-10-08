"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OnboardingProgress from "@/components/onboarding-progress";

const kpis = [
  "Revenue",
  "Sales",
  "Conversion rate",
  "Customer acquisition",
  "Customer retention",
  "Engagement",
  "Reach",
  "Followers",
  "Website traffic",
  "Return on ad spend",
];

export default function MeasurementPage() {
  const router = useRouter();
  const supabase = createClient();

  const [brandId, setBrandId] = useState("");
  const [primary, setPrimary] = useState<string[]>([]);
  const [secondary, setSecondary] = useState<string[]>([]);
  const [goals, setGoals] = useState("");
  const [success, setSuccess] = useState("");
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
        .select("id, measurement")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!data) {
        setError("Brand not found.");
        setLoading(false);
        return;
      }

      setBrandId(data.id);

      const value = data.measurement || {};

      setPrimary(value.primary_kpis || []);
      setSecondary(value.secondary_kpis || []);
      setGoals(value.business_goals || "");
      setSuccess(value.success_criteria || "");

      setLoading(false);
    }

    load();
  }, []);

  function toggle(value: string, current: string[], setter: any) {
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
        measurement: {
          primary_kpis: primary,
          secondary_kpis: secondary,
          business_goals: goals.trim(),
          success_criteria: success.trim(),
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
      await supabase.from("profiles").update({ onboarding_step: 9 }).eq("id", user.id);
    }

    router.push("/onboarding/business-data");
  }

  if (loading) return <Loading />;

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <OnboardingProgress step={8} />
        <section className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">Step 08</p>

        <h1 className="mt-3 text-4xl font-bold">Define success</h1>

        <p className="mt-3 mb-10 text-gray-500">
          Tell your AI which outcomes matter to your business.
        </p>

        <div className="space-y-8">
          <ChoiceGroup label="Primary KPIs" values={kpis} selected={primary} onToggle={(x: string) => toggle(x, primary, setPrimary)} />

          <ChoiceGroup label="Secondary KPIs" values={kpis} selected={secondary} onToggle={(x: string) => toggle(x, secondary, setSecondary)} />

          <Field label="What are your main business goals?" placeholder="Example: Increase online sales by improving conversion..." value={goals} onChange={setGoals} />

          <Field label="What would success look like?" placeholder="Describe the outcomes you want the AI to help you achieve..." value={success} onChange={setSuccess} />

          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <div className="flex justify-between border-t border-[#e8d4f1] pt-7">
            <button onClick={() => router.push("/onboarding/constraints")} className="rounded-xl px-5 py-3 text-sm text-gray-500 hover:bg-gray-100">
              ← Back
            </button>

            <button onClick={handleContinue} disabled={saving} className="rounded-xl bg-[#2a073c] px-7 py-3.5 font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : "Continue →"}
            </button>
          </div>
        </div>
          </div>
        </section>
      </div>
    </main>
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
            onClick={() => onToggle(value)}
            className={`rounded-full border px-4 py-2 text-sm ${
              selected.includes(value)
                ? "border-[#b57fdc] bg-[#e8d4f1] font-semibold"
                : "border-gray-200"
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
      <textarea rows={4} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full resize-none rounded-xl border border-[#e8d4f1] px-4 py-3.5 text-sm outline-none focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]" />
    </div>
  );
}

function Loading() {
  return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
}