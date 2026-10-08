"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OnboardingProgress from "@/components/onboarding-progress";

export default function ReviewPage() {
  const router = useRouter();
  const supabase = createClient();

  const [brand, setBrand] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data: brandData } = await supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      const { data: documentsData } = await supabase
        .from("documents")
        .select("*")
        .eq("brand_id", brandData?.id || "");

      const { data: channelsData } = await supabase
        .from("channel_connections")
        .select("*")
        .eq("brand_id", brandData?.id || "");

      setBrand(brandData);
      setDocuments(documentsData || []);
      setChannels(channelsData || []);
      setLoading(false);
    }

    load();
  }, []);

  async function finish() {
    setFinishing(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/sign-in");
      setFinishing(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        onboarding_completed: true,
        onboarding_step: 14,
      })
      .eq("id", user.id);

    if (!error) {
      router.push("/dashboard");
    } else {
      setError(error.message);
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf7fc] text-[#2a073c]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <OnboardingProgress step={13} />
        <section className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-4xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">
            Step 13
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Your AI is almost ready
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-gray-500">
            Review your brand information before entering your marketing
            intelligence workspace.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Card title="Brand">
            <p className="text-xl font-semibold">{brand?.name}</p>
            <p className="mt-2 text-sm text-gray-500">
              {brand?.description || "No description provided"}
            </p>

            <div className="mt-4 text-sm">
              <span className="text-gray-400">Industry: </span>
              {brand?.industry || "Not specified"}
            </div>

            <div className="mt-1 text-sm">
              <span className="text-gray-400">Business model: </span>
              {brand?.business_model || "Not specified"}
            </div>
          </Card>

          <Card title="Positioning">
            <Summary data={brand?.positioning} />
          </Card>

          <Card title="Customer">
            <Summary data={brand?.customer} />
          </Card>

          <Card title="Brand Voice">
            <Summary data={brand?.brand_voice} />
          </Card>

          <Card title="Market">
            <Summary data={brand?.market} />
          </Card>

          <Card title="Marketing">
            <Summary data={brand?.marketing} />
          </Card>

          <Card title="Constraints">
            <Summary data={brand?.constraints} />
          </Card>

          <Card title="Measurement">
            <Summary data={brand?.measurement} />
          </Card>

          <Card title="Connected Channels">
            {channels.length === 0 ? (
              <p className="text-sm text-gray-500">No channels connected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {channels.map((channel) => (
                  <span
                    key={channel.id}
                    className="rounded-full bg-[#e8d4f1] px-3 py-1 text-sm"
                  >
                    {channel.provider}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card title="Knowledge">
            <p className="text-3xl font-bold">{documents.length}</p>
            <p className="text-sm text-gray-500">
              brand document{documents.length === 1 ? "" : "s"} uploaded
            </p>
          </Card>
        </div>

        <div className="mt-10 rounded-2xl bg-[#2a073c] p-8 text-white">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div>
              <h2 className="text-2xl font-bold">
                Ready to meet your AI marketing agent?
              </h2>

              <p className="mt-2 text-[#e8d4f1]">
                Your brand context will be available to the agent.
              </p>
            </div>

            <button
              onClick={finish}
              disabled={finishing}
              className="rounded-xl bg-[#cba5ea] px-7 py-3.5 font-semibold text-[#2a073c] hover:bg-[#e8d4f1] disabled:opacity-60"
            >
              {finishing ? "Preparing..." : "Enter MarketingAI →"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-5 rounded-lg bg-red-950/50 px-4 py-3 text-sm text-red-100">
              {error}
            </p>
          )}
        </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, children }: any) {
  return (
    <div className="rounded-2xl border border-[#e8d4f1] bg-white p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Summary({ data }: { data: any }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No information provided.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="text-sm">
          <span className="font-medium capitalize">
            {key.replaceAll("_", " ")}:
          </span>{" "}
          <span className="text-gray-500">
            {Array.isArray(value)
              ? value.join(", ")
              : String(value || "—")}
          </span>
        </div>
      ))}
    </div>
  );
}