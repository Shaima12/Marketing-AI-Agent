"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const steps = [
  "Brand basics",
  "Positioning",
  "Customer",
  "Brand voice",
  "Market",
  "Marketing",
  "Constraints",
  "Measurement",
  "Business data",
  "Table permissions",
  "Channels",
  "Documents",
  "Review",
];

export default function OnboardingPage() {
  const supabase = createClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessModel, setBusinessModel] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Your session has expired. Please sign in again.");
      setLoading(false);
      return;
    }

    // Create the brand
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        website_url: websiteUrl.trim() || null,
        industry: industry.trim() || null,
        business_model: businessModel.trim() || null,
      })
      .select("id")
      .single();

    if (brandError) {
      setError(brandError.message);
      setLoading(false);
      return;
    }

    // Save onboarding progress
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        onboarding_step: 2,
      })
      .eq("id", user.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    console.log("Brand created:", brand.id);

    // Temporary navigation until we build Step 2
    window.location.href = "/onboarding/positioning";
  }

  return (
    <main className="min-h-screen bg-[#faf8fc] text-[#2a073c]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-80 shrink-0 border-r border-[#e8d4f1] bg-white lg:flex lg:flex-col">
          <div className="border-b border-[#e8d4f1] px-8 py-7">
            <a
              href="/"
              className="text-2xl font-bold tracking-tight text-[#2a073c]"
            >
              Marketing<span className="text-[#b57fdc]">AI</span>
            </a>

            <p className="mt-2 text-sm text-gray-500">
              Let&apos;s set up your marketing intelligence.
            </p>
          </div>

          <div className="flex-1 px-6 py-8">
            <p className="mb-5 px-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Setup
            </p>

            <div className="space-y-1">
              {steps.map((step, index) => {
                const stepNumber = index + 1;
                const active = stepNumber === 1;

                return (
                  <div
                    key={step}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      active
                        ? "bg-[#e8d4f1]/60 text-[#2a073c]"
                        : "text-gray-400"
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        active
                          ? "bg-[#2a073c] text-white"
                          : "border border-gray-200 bg-white text-gray-400"
                      }`}
                    >
                      {stepNumber}
                    </div>

                    <span
                      className={`text-sm ${
                        active ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[#e8d4f1] p-6">
            <div className="rounded-2xl bg-[#2a073c] p-5 text-white">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[#b57fdc]" />
                <span className="text-xs font-medium text-[#e8d4f1]">
                  AI SETUP
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-white/80">
                Your answers will help the AI understand your brand and make
                relevant marketing decisions.
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="flex flex-1 flex-col">
          {/* Mobile header */}
          <header className="border-b border-[#e8d4f1] bg-white px-6 py-5 lg:hidden">
            <div className="flex items-center justify-between">
              <a
                href="/"
                className="text-xl font-bold text-[#2a073c]"
              >
                Marketing<span className="text-[#b57fdc]">AI</span>
              </a>

              <span className="text-sm font-medium text-gray-500">
                Step 1 of 13
              </span>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e8d4f1]">
              <div className="h-full w-[7.7%] rounded-full bg-[#b57fdc]" />
            </div>
          </header>

          <div className="flex flex-1 items-start justify-center px-6 py-10 sm:px-10 lg:px-16 lg:py-16">
            <div className="w-full max-w-3xl">
              {/* Progress */}
              <div className="mb-10 hidden items-center justify-between lg:flex">
                <div>
                  <p className="text-sm font-semibold text-[#b57fdc]">
                    STEP 01
                  </p>

                  <p className="mt-1 text-sm text-gray-400">
                    Brand basics
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-2 w-40 overflow-hidden rounded-full bg-[#e8d4f1]">
                    <div className="h-full w-full rounded-full bg-[#b57fdc]" />
                  </div>

                  <span className="text-sm font-medium text-gray-400">
                    1 / 13
                  </span>
                </div>
              </div>

              {/* Heading */}
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8d4f1] text-xl text-[#2a073c]">
                  ✦
                </div>

                <h1 className="text-4xl font-bold tracking-tight text-[#2a073c] sm:text-5xl">
                  Tell us about your brand
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-gray-500 sm:text-lg">
                  Start with the basics. This information gives your AI
                  marketing assistant the foundation it needs to understand
                  your business.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleContinue} className="mt-10 space-y-7">
                {/* Brand name */}
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2.5 block text-sm font-semibold text-[#2a073c]"
                  >
                    Brand name <span className="text-[#b57fdc]">*</span>
                  </label>

                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. NOVA Fashion"
                    className="w-full rounded-2xl border border-[#e8d4f1] bg-white px-5 py-4 text-[#2a073c] outline-none transition placeholder:text-gray-300 focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]/60"
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="description"
                    className="mb-2.5 block text-sm font-semibold text-[#2a073c]"
                  >
                    What does your brand do?
                  </label>

                  <textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe your brand, products or services in a few sentences..."
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-[#e8d4f1] bg-white px-5 py-4 text-[#2a073c] outline-none transition placeholder:text-gray-300 focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]/60"
                  />

                  <p className="mt-2 text-xs text-gray-400">
                    Write naturally. You don&apos;t need to use marketing
                    terminology.
                  </p>
                </div>

                {/* Website */}
                <div>
                  <label
                    htmlFor="website"
                    className="mb-2.5 block text-sm font-semibold text-[#2a073c]"
                  >
                    Website
                  </label>

                  <input
                    id="website"
                    type="url"
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    placeholder="https://yourbrand.com"
                    className="w-full rounded-2xl border border-[#e8d4f1] bg-white px-5 py-4 text-[#2a073c] outline-none transition placeholder:text-gray-300 focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]/60"
                  />
                </div>

                {/* Industry + Business model */}
                <div className="grid gap-7 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="industry"
                      className="mb-2.5 block text-sm font-semibold text-[#2a073c]"
                    >
                      Industry
                    </label>

                    <select
                      id="industry"
                      value={industry}
                      onChange={(event) => setIndustry(event.target.value)}
                      className="w-full appearance-none rounded-2xl border border-[#e8d4f1] bg-white px-5 py-4 text-[#2a073c] outline-none transition focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]/60"
                    >
                      <option value="">Select industry</option>
                      <option value="fashion">Fashion</option>
                      <option value="beauty">Beauty & Cosmetics</option>
                      <option value="food">Food & Beverage</option>
                      <option value="retail">Retail</option>
                      <option value="technology">Technology</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="finance">Finance</option>
                      <option value="education">Education</option>
                      <option value="travel">Travel & Hospitality</option>
                      <option value="media">Media & Entertainment</option>
                      <option value="professional_services">
                        Professional Services
                      </option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="businessModel"
                      className="mb-2.5 block text-sm font-semibold text-[#2a073c]"
                    >
                      Business model
                    </label>

                    <select
                      id="businessModel"
                      value={businessModel}
                      onChange={(event) =>
                        setBusinessModel(event.target.value)
                      }
                      className="w-full appearance-none rounded-2xl border border-[#e8d4f1] bg-white px-5 py-4 text-[#2a073c] outline-none transition focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]/60"
                    >
                      <option value="">Select model</option>
                      <option value="b2c">B2C</option>
                      <option value="b2b">B2B</option>
                      <option value="b2b2c">B2B2C</option>
                      <option value="ecommerce">E-commerce</option>
                      <option value="marketplace">Marketplace</option>
                      <option value="subscription">Subscription</option>
                      <option value="service">Service</option>
                      <option value="saas">SaaS</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-600">
                    {error}
                  </div>
                )}

                {/* Bottom actions */}
                <div className="flex items-center justify-between border-t border-[#e8d4f1] pt-7">
                  <p className="hidden text-sm text-gray-400 sm:block">
                    You can continue and complete the rest later.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="ml-auto flex items-center gap-3 rounded-xl bg-[#2a073c] px-7 py-3.5 font-semibold text-white transition hover:bg-[#3d1055] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Saving..." : "Continue"}

                    {!loading && <span>→</span>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}