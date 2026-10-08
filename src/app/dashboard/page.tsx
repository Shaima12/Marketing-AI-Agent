import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function hasSavedData(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") {
    return Object.values(value).some(hasSavedData);
  }
  return value !== null && value !== undefined;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const [{ data: brand }, { data: profile }, { data: documents }] =
    await Promise.all([
      supabase
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("documents").select("id").eq("user_id", user.id),
    ]);

  if (!profile?.onboarding_completed) redirect("/onboarding");

  const [{ data: channels }, { data: connections }] = brand?.id
    ? await Promise.all([
        supabase
          .from("channel_connections")
          .select("id, provider")
          .eq("brand_id", brand.id),
        supabase
          .from("data_connections")
          .select("id, name, status")
          .eq("brand_id", brand.id),
      ])
    : [{ data: [] }, { data: [] }];

  const sections = [
    brand?.positioning,
    brand?.customer,
    brand?.brand_voice,
    brand?.market,
    brand?.marketing,
    brand?.constraints,
    brand?.measurement,
  ];
  const coveredSections = sections.filter(hasSavedData).length;
  const fullName = user.user_metadata?.full_name || "there";

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-[#251d31] px-6 py-8 text-white sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[36px] border-[#b57fdc]/15" />
        <div className="pointer-events-none absolute bottom-0 right-24 h-2 w-24 bg-[#b7d8a8]" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b6ed]">
            Workspace overview
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome, {fullName.split(" ")[0]}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
            Your brand context is together in one place. Review what the
            assistant knows or start a conversation about your next move.
          </p>
          <Link
            href="/dashboard/assistant"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#dcebd9] px-4 py-2.5 text-sm font-semibold text-[#263d31] transition hover:bg-white"
          >
            Open assistant <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <section aria-label="Workspace summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStat label="Onboarding" value="Complete" detail="13 of 13 steps" tone="green" />
        <SummaryStat label="Brand context" value={`${coveredSections} / 7`} detail="strategy sections filled" />
        <SummaryStat label="Channels" value={String(channels?.length || 0)} detail="connected or selected" />
        <SummaryStat label="Knowledge files" value={String(documents?.length || 0)} detail={`${connections?.length || 0} data connection${connections?.length === 1 ? "" : "s"}`} />
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8494]">
                Your foundation
              </p>
              <h2 className="mt-1 text-xl font-semibold">Brand snapshot</h2>
            </div>
            <Link
              href="/dashboard/brand"
              className="text-sm font-medium text-[#65467b] hover:text-[#2a073c]"
            >
              View brand ↗
            </Link>
          </div>

          {brand ? (
            <div className="divide-y divide-[#e7e4e9] border-y border-[#e7e4e9]">
              <div className="flex flex-col justify-between gap-3 py-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-lg font-semibold">{brand.name}</h3>
                  <p className="mt-1 text-sm text-[#77717f]">
                    {brand.industry || "Industry not set"}
                    {brand.business_model ? ` · ${brand.business_model}` : ""}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-[#e7f0e3] px-3 py-1 text-xs font-medium text-[#426344]">
                  Brand profile ready
                </span>
              </div>
              <div className="grid gap-5 py-5 sm:grid-cols-2">
                <Snapshot label="Audience" value={brand.customer?.target_audience} />
                <Snapshot label="Positioning" value={brand.positioning?.value_proposition} />
                <Snapshot label="Marketing focus" value={brand.marketing?.objectives} />
                <Snapshot label="Brand voice" value={brand.brand_voice?.tone} />
              </div>
            </div>
          ) : (
            <p className="border-y border-[#e7e4e9] py-6 text-sm text-[#77717f]">
              No brand profile is available yet.
            </p>
          )}
        </div>

        <aside className="border-l-2 border-[#b7d8a8] pl-5 sm:pl-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8494]">
            Assistant context
          </p>
          <h2 className="mt-1 text-xl font-semibold">Ready to use</h2>
          <p className="mt-3 text-sm leading-6 text-[#77717f]">
            Your saved positioning, audience, voice, market, marketing goals,
            constraints, and success measures are available in the brand
            workspace.
          </p>
          <div className="mt-5 space-y-2.5">
            {[
              ["Brand profile", Boolean(brand)],
              ["Knowledge files", (documents?.length || 0) > 0],
              ["Business data", (connections?.length || 0) > 0],
            ].map(([label, ready]) => (
              <div key={String(label)} className="flex items-center gap-2.5 text-sm">
                <span className={`h-2 w-2 rounded-full ${ready ? "bg-[#6a9a6e]" : "bg-[#cbc6ce]"}`} />
                <span className="text-[#56505d]">{label}</span>
                <span className="ml-auto text-xs text-[#8d8494]">
                  {ready ? "Added" : "Not added"}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/brand"
            className="mt-5 inline-block text-sm font-medium text-[#65467b] hover:text-[#2a073c]"
          >
            Explore assistant knowledge ↗
          </Link>
        </aside>
      </section>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "green";
}) {
  return (
    <div className="border-t-2 border-[#ded9e2] bg-white/60 px-4 py-4">
      <p className="text-xs font-medium text-[#77717f]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone === "green" ? "text-[#426344]" : "text-[#292437]"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-[#8d8494]">{detail}</p>
    </div>
  );
}

function Snapshot({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#8d8494]">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#514a58]">
        {value || "Not provided"}
      </p>
    </div>
  );
}