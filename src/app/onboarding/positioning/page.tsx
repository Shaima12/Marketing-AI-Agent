"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

export default function PositioningPage() {
  const router = useRouter();
  const supabase = createClient();

  const [brandId, setBrandId] = useState<string | null>(null);

  const [mission, setMission] = useState("");
  const [vision, setVision] = useState("");
  const [values, setValues] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [differentiators, setDifferentiators] = useState("");
  const [brandPromise, setBrandPromise] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBrand() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data, error } = await supabase
        .from("brands")
        .select("id, positioning")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (error || !data) {
        setError("We couldn't find your brand.");
        setLoading(false);
        return;
      }

      setBrandId(data.id);

      const positioning = data.positioning || {};

      setMission(positioning.mission || "");
      setVision(positioning.vision || "");
      setValues(positioning.values || "");
      setValueProposition(positioning.value_proposition || "");
      setDifferentiators(positioning.differentiators || "");
      setBrandPromise(positioning.brand_promise || "");

      setLoading(false);
    }

    loadBrand();
  }, [router]);

  async function handleContinue() {
    if (!brandId) return;

    setError("");
    setSaving(true);

    const { error } = await supabase
      .from("brands")
      .update({
        positioning: {
          mission: mission.trim(),
          vision: vision.trim(),
          values: values.trim(),
          value_proposition: valueProposition.trim(),
          differentiators: differentiators.trim(),
          brand_promise: brandPromise.trim(),
        },
      })
      .eq("id", brandId);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({
        onboarding_step: 3,
      })
      .eq("id", (await supabase.auth.getUser()).data.user?.id);

    router.push("/onboarding/customer");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-sm text-gray-500">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-72 border-r border-[#e8d4f1] bg-[#faf7fc] p-8 lg:block">
          <div className="mb-12">
            <div className="text-2xl font-bold">
              Marketing<span className="text-[#b57fdc]">AI</span>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Set up your marketing intelligence
            </p>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => {
              const stepNumber = index + 1;
              const active = stepNumber === 2;
              const completed = stepNumber < 2;

              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                    active
                      ? "bg-[#e8d4f1] text-[#2a073c]"
                      : "text-gray-400"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      completed
                        ? "bg-[#b57fdc] text-white"
                        : active
                        ? "bg-[#2a073c] text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {completed ? "✓" : stepNumber}
                  </div>

                  <span className="text-sm font-medium">{step}</span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main */}
        <section className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-2xl">
            {/* Mobile header */}
            <div className="mb-10 lg:hidden">
              <div className="text-xl font-bold">
                Marketing<span className="text-[#b57fdc]">AI</span>
              </div>

              <p className="mt-2 text-sm text-gray-500">
                Step 2 of 13
              </p>
            </div>

            <div className="mb-10">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">
                Step 02
              </p>

              <h1 className="text-4xl font-bold tracking-tight text-[#2a073c]">
                Position your brand
              </h1>

              <p className="mt-3 max-w-xl text-gray-500">
                Help your AI understand what your brand stands for and why
                customers should choose you.
              </p>
            </div>

            <div className="space-y-7">
              <Field
                label="What does your brand exist to achieve?"
                placeholder="Example: Make high-quality fashion accessible to modern women..."
                value={mission}
                onChange={setMission}
              />

              <Field
                label="What do you want your brand to become?"
                placeholder="Example: Become the most trusted contemporary fashion brand in Tunisia..."
                value={vision}
                onChange={setVision}
              />

              <Field
                label="What principles are important to your brand?"
                placeholder="Example: Quality, simplicity, confidence, sustainability..."
                value={values}
                onChange={setValues}
              />

              <Field
                label="Why should customers choose you?"
                placeholder="What value do you provide that customers cannot easily get elsewhere?"
                value={valueProposition}
                onChange={setValueProposition}
              />

              <Field
                label="What makes your brand different?"
                placeholder="Describe your main differentiators..."
                value={differentiators}
                onChange={setDifferentiators}
              />

              <Field
                label="What do you promise your customers?"
                placeholder="Example: Every product should make the customer feel confident and comfortable..."
                value={brandPromise}
                onChange={setBrandPromise}
              />

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[#e8d4f1] pt-7">
                <button
                  type="button"
                  onClick={() => router.push("/onboarding")}
                  className="rounded-xl px-5 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100"
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={saving}
                  className="rounded-xl bg-[#2a073c] px-7 py-3.5 font-semibold text-white transition hover:bg-[#3d1055] disabled:cursor-not-allowed disabled:opacity-60"
                >
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

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-[#2a073c]">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-xl border border-[#e8d4f1] bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]"
      />
    </div>
  );
}
