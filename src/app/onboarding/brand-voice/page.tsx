"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const personalities = [
  "Elegant",
  "Modern",
  "Friendly",
  "Confident",
  "Playful",
  "Professional",
  "Warm",
  "Bold",
  "Minimal",
  "Inspirational",
];

const tones = [
  "Warm",
  "Confident",
  "Professional",
  "Casual",
  "Elegant",
  "Energetic",
  "Educational",
  "Empathetic",
];

export default function BrandVoicePage() {
  const router = useRouter();
  const supabase = createClient();

  const [brandId, setBrandId] = useState("");

  const [personality, setPersonality] = useState<string[]>([]);
  const [tone, setTone] = useState<string[]>([]);
  const [topics, setTopics] = useState("");
  const [preferredWords, setPreferredWords] = useState("");
  const [avoidWords, setAvoidWords] = useState("");
  const [style, setStyle] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data, error } = await supabase
        .from("brands")
        .select("id, brand_voice")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (error || !data) {
        setError("Brand not found.");
        setLoading(false);
        return;
      }

      setBrandId(data.id);

      const voice = data.brand_voice || {};

      setPersonality(voice.personality || []);
      setTone(voice.tone || []);
      setTopics(voice.content_themes || "");
      setPreferredWords(voice.preferred_words || "");
      setAvoidWords(voice.avoid_words || "");
      setStyle(voice.style || "");

      setLoading(false);
    }

    load();
  }, []);

  function toggleValue(
    value: string,
    current: string[],
    setter: (value: string[]) => void
  ) {
    setter(
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  async function handleContinue() {
    setSaving(true);
    setError("");

    const { error } = await supabase
      .from("brands")
      .update({
        brand_voice: {
          personality,
          tone,
          content_themes: topics.trim(),
          preferred_words: preferredWords.trim(),
          avoid_words: avoidWords.trim(),
          style: style.trim(),
        },
      })
      .eq("id", brandId);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({
          onboarding_step: 5,
        })
        .eq("id", user.id);
    }

    router.push("/onboarding/market");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-72 border-r border-[#e8d4f1] bg-[#faf7fc] p-8 lg:block">
          <div className="mb-10 text-2xl font-bold">
            Marketing<span className="text-[#b57fdc]">AI</span>
          </div>

          <div className="space-y-2">
            {[
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
            ].map((name, index) => {
              const step = index + 1;

              return (
                <div
                  key={name}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                    step === 4 ? "bg-[#e8d4f1]" : ""
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      step < 4
                        ? "bg-[#b57fdc] text-white"
                        : step === 4
                        ? "bg-[#2a073c] text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {step < 4 ? "✓" : step}
                  </div>

                  <span className="text-sm">{name}</span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main */}
        <section className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">
              Step 04
            </p>

            <h1 className="text-4xl font-bold">
              Give your brand a voice
            </h1>

            <p className="mt-3 mb-10 text-gray-500">
              Tell your AI how your brand should communicate with customers.
            </p>

            <div className="space-y-8">
              {/* Personality */}
              <ChoiceGroup
                label="How would you describe your brand personality?"
                values={personalities}
                selected={personality}
                onToggle={(value) =>
                  toggleValue(value, personality, setPersonality)
                }
              />

              {/* Tone */}
              <ChoiceGroup
                label="What tone should your brand use?"
                values={tones}
                selected={tone}
                onToggle={(value) =>
                  toggleValue(value, tone, setTone)
                }
              />

              {/* Content themes */}
              <Field
                label="What topics should your brand talk about?"
                placeholder="Example: fashion inspiration, styling advice, product stories, customer stories..."
                value={topics}
                onChange={setTopics}
              />

              {/* Preferred words */}
              <Field
                label="Are there words or expressions your brand likes to use?"
                placeholder="Example: timeless, confidence, effortless, contemporary..."
                value={preferredWords}
                onChange={setPreferredWords}
              />

              {/* Avoid */}
              <Field
                label="Are there words or expressions your brand should avoid?"
                placeholder="Example: cheap, guaranteed, exaggerated claims..."
                value={avoidWords}
                onChange={setAvoidWords}
              />

              {/* Style */}
              <Field
                label="Describe your communication style"
                placeholder="Example: Modern, warm and confident. We communicate clearly without sounding aggressive or overly promotional."
                value={style}
                onChange={setStyle}
              />

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between border-t border-[#e8d4f1] pt-7">
                <button
                  onClick={() => router.push("/onboarding/customer")}
                  className="rounded-xl px-5 py-3 text-sm text-gray-500 transition hover:bg-gray-100"
                >
                  ← Back
                </button>

                <button
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

function ChoiceGroup({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-3 block text-sm font-semibold">
        {label}
      </label>

      <div className="flex flex-wrap gap-3">
        {values.map((value) => {
          const active = selected.includes(value);

          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                active
                  ? "border-[#b57fdc] bg-[#e8d4f1] font-semibold text-[#2a073c]"
                  : "border-gray-200 bg-white hover:border-[#b57fdc]"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
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
      <label className="mb-2 block text-sm font-semibold">
        {label}
      </label>

      <textarea
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none rounded-xl border border-[#e8d4f1] px-4 py-3.5 text-sm outline-none transition focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]"
      />
    </div>
  );
}