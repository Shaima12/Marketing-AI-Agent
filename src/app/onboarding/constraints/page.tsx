"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OnboardingProgress from "@/components/onboarding-progress";

export default function ConstraintsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [brandId, setBrandId] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [compliance, setCompliance] = useState("");
  const [avoid, setAvoid] = useState("");
  const [operational, setOperational] = useState("");
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
        .select("id, constraints")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!data) {
        setError("Brand not found.");
        setLoading(false);
        return;
      }

      setBrandId(data.id);

      const value = data.constraints || {};

      setRestrictions(value.restrictions || "");
      setCompliance(value.compliance || "");
      setAvoid(value.avoid || "");
      setOperational(value.operational || "");

      setLoading(false);
    }

    load();
  }, []);

  async function handleContinue() {
    setSaving(true);

    const { error } = await supabase
      .from("brands")
      .update({
        constraints: {
          restrictions: restrictions.trim(),
          compliance: compliance.trim(),
          avoid: avoid.trim(),
          operational: operational.trim(),
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
      await supabase.from("profiles").update({ onboarding_step: 8 }).eq("id", user.id);
    }

    router.push("/onboarding/measurement");
  }

  if (loading) return <Loading />;

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <OnboardingProgress step={7} />
        <section className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">Step 07</p>

        <h1 className="mt-3 text-4xl font-bold">Set your guardrails</h1>

        <p className="mt-3 mb-10 text-gray-500">
          Tell the AI what it must respect when working with your brand.
        </p>

        <div className="space-y-7">
          <Field label="Brand restrictions" placeholder="What should the AI never do?" value={restrictions} onChange={setRestrictions} />

          <Field label="Legal or compliance requirements" placeholder="Any regulations, claims or requirements to respect?" value={compliance} onChange={setCompliance} />

          <Field label="Content to avoid" placeholder="Topics, words, claims or styles to avoid..." value={avoid} onChange={setAvoid} />

          <Field label="Operational constraints" placeholder="Budget, resources, approval processes, timing..." value={operational} onChange={setOperational} />

          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <div className="flex justify-between border-t border-[#e8d4f1] pt-7">
            <button onClick={() => router.push("/onboarding/marketing")} className="rounded-xl px-5 py-3 text-sm text-gray-500 hover:bg-gray-100">
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

function Loading() {
  return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
}