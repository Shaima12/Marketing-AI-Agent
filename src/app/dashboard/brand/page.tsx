import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function hasData(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasData);
  if (value && typeof value === "object") {
    return Object.values(value).some(hasData);
  }
  return value !== null && value !== undefined;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key.replaceAll("_", " ")}: ${formatValue(item)}`)
      .join(" · ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "");
}

function BrandSection({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: Record<string, unknown>;
}) {
  const fields = Object.entries(data).filter(([, value]) => hasData(value));

  return (
    <section className="border-t border-[#e7e4e9] py-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[#817989]">{description}</p>
        </div>
        <span className="w-fit rounded-full bg-[#f0edf2] px-2.5 py-1 text-[11px] font-medium text-[#716879]">
          {fields.length} {fields.length === 1 ? "field" : "fields"}
        </span>
      </div>

      {fields.length ? (
        <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {fields.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8d8494]">
                {key.replaceAll("_", " ")}
              </dt>
              <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-[#514a58]">
                {formatValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 text-sm text-[#9b949f]">Nothing added yet.</p>
      )}
    </section>
  );
}

export default async function BrandPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return (
      <section className="py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8d8494]">
          Brand workspace
        </p>
        <h1 className="mt-3 text-2xl font-semibold">No brand profile found</h1>
        <p className="mt-2 text-sm text-[#77717f]">
          Complete onboarding to give your assistant useful brand context.
        </p>
        <Link
          href="/onboarding"
          className="mt-5 inline-flex rounded-lg bg-[#251d31] px-4 py-2.5 text-sm font-medium text-white"
        >
          Continue onboarding
        </Link>
      </section>
    );
  }

  const [{ data: documents }, { data: channels }, { data: connections }] =
    await Promise.all([
      supabase
        .from("documents")
        .select("id, title, description, file_type, status")
        .eq("brand_id", brand.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("channel_connections")
        .select("id, provider, status")
        .eq("brand_id", brand.id),
      supabase
        .from("data_connections")
        .select("id, name, database_type, status")
        .eq("brand_id", brand.id),
    ]);
  const connectionIds = (connections || []).map((connection) => connection.id);
  const { data: businessTables } = connectionIds.length
    ? await supabase
        .from("data_connection_tables")
        .select("id, connection_id, table_schema, table_name, description, enabled")
        .in("connection_id", connectionIds)
        .order("table_schema")
        .order("table_name")
    : { data: [] };
  const tableIds = (businessTables || []).map((table) => table.id);
  const { data: businessColumns } = tableIds.length
    ? await supabase
        .from("data_connection_columns")
        .select("table_id, column_name, data_type, is_nullable, is_primary_key, description, selected")
        .in("table_id", tableIds)
        .order("column_name")
    : { data: [] };

  const sections = [
    {
      title: "Brand identity",
      description: "The essential details behind this business.",
      data: {
        description: brand.description,
        website: brand.website_url,
        industry: brand.industry,
        business_model: brand.business_model,
      },
    },
    {
      title: "Positioning",
      description: "Purpose, promise, and reasons customers choose you.",
      data: brand.positioning || {},
    },
    {
      title: "Customer",
      description: "Audience, needs, pain points, and desired outcomes.",
      data: brand.customer || {},
    },
    {
      title: "Brand voice",
      description: "Personality, tone, themes, and language preferences.",
      data: brand.brand_voice || {},
    },
    {
      title: "Market",
      description: "Category, competitors, position, and relevant trends.",
      data: brand.market || {},
    },
    {
      title: "Marketing",
      description: "Objectives, channels, content, and growth priorities.",
      data: brand.marketing || {},
    },
    {
      title: "Constraints",
      description: "Rules and practical boundaries the assistant should respect.",
      data: brand.constraints || {},
    },
    {
      title: "Measurement",
      description: "KPIs, business goals, and criteria for success.",
      data: brand.measurement || {},
    },
  ];
  const filledSections = sections.filter((section) =>
    Object.values(section.data).some(hasData)
  ).length;

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 border-b border-[#ded9e2] pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#816696]">
            Brand intelligence
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{brand.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77717f]">
            Your saved brand profile and the context available to your assistant.
          </p>
        </div>
        <Link
          href="/dashboard/assistant"
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#251d31] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#3b3048]"
        >
          <span className="text-[#d6b6ed]">✦</span> Ask about your brand
        </Link>
      </div>

      <div className="grid gap-8 py-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8d8494]">
              Brand profile
            </h2>
            <span className="text-xs text-[#8d8494]">{filledSections} of 8 sections with details</span>
          </div>

          {sections.map((section) => (
            <BrandSection key={section.title} {...section} />
          ))}
        </div>

        <aside className="h-fit border-t-2 border-[#b7d8a8] bg-white px-5 py-5 xl:sticky xl:top-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#53755a]">
            Assistant knowledge
          </p>
          <h2 className="mt-2 text-lg font-semibold">What it can reference</h2>
          <p className="mt-2 text-sm leading-6 text-[#77717f]">
            The assistant context is built from the information saved here. It
            does not infer missing details.
          </p>

          <div className="mt-5 space-y-3 border-t border-[#ebe8ed] pt-4">
            <SourceCount label="Brand sections" value={`${filledSections} / 8`} />
            <SourceCount label="Documents" value={String(documents?.length || 0)} />
            <SourceCount label="Channels" value={String(channels?.length || 0)} />
            <SourceCount label="Data connections" value={String(connections?.length || 0)} />
          </div>

          {(documents?.length || 0) > 0 && (
            <div className="mt-5 border-t border-[#ebe8ed] pt-4">
              <p className="mb-3 text-xs font-semibold text-[#514a58]">Knowledge files</p>
              <ul className="space-y-2">
                {documents?.map((document) => (
                  <li key={document.id} className="text-xs leading-5 text-[#77717f]">
                    <span className="font-medium text-[#514a58]">{document.title}</span>
                    {document.file_type ? ` · ${document.file_type}` : ""}
                    {document.status ? ` · ${document.status}` : ""}
                    {document.description && (
                      <span className="mt-0.5 block text-[#96909a]">{document.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(channels?.length || 0) > 0 && (
            <div className="mt-5 border-t border-[#ebe8ed] pt-4">
              <p className="mb-3 text-xs font-semibold text-[#514a58]">Selected channels</p>
              <div className="flex flex-wrap gap-2">
                {channels?.map((channel) => (
                  <span key={channel.id} className="rounded-md bg-[#f0edf2] px-2.5 py-1.5 text-xs text-[#5c5364]">
                    {channel.provider}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(connections?.length || 0) > 0 && (
            <div className="mt-5 border-t border-[#ebe8ed] pt-4">
              <p className="mb-3 text-xs font-semibold text-[#514a58]">Data connections</p>
              <ul className="space-y-2">
                {connections?.map((connection) => (
                  <li key={connection.id} className="text-xs leading-5 text-[#77717f]">
                    <span className="font-medium text-[#514a58]">{connection.name}</span>
                    {connection.database_type ? ` · ${connection.database_type}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(businessTables?.length || 0) > 0 && (
            <div className="mt-5 border-t border-[#ebe8ed] pt-4">
              <p className="mb-3 text-xs font-semibold text-[#514a58]">Allowed tables</p>
              <ul className="space-y-3">
                {businessTables?.map((table) => {
                  const columns = businessColumns?.filter(
                    (column) => column.table_id === table.id && column.selected
                  ) || [];

                  return (
                    <li key={table.id} className="border-l-2 border-[#dcebd9] pl-3">
                      <p className="break-words text-xs font-medium text-[#514a58]">
                        {table.table_schema}.{table.table_name}
                      </p>
                      {table.description && (
                        <p className="mt-1 text-xs leading-5 text-[#817989]">{table.description}</p>
                      )}
                      <p className="mt-1 text-[11px] text-[#96909a]">
                        {columns.length} accessible column{columns.length === 1 ? "" : "s"}
                      </p>
                      {columns.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] font-medium text-[#65467b]">
                            View columns
                          </summary>
                          <ul className="mt-2 space-y-1.5">
                            {columns.map((column) => (
                              <li key={`${table.id}-${column.column_name}`} className="text-[11px] leading-4 text-[#817989]">
                                <span className="font-medium text-[#5c5364]">{column.column_name}</span>
                                {column.data_type ? ` · ${column.data_type}` : ""}
                                {column.is_primary_key ? " · primary key" : ""}
                                {column.description ? ` · ${column.description}` : ""}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SourceCount({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[#77717f]">{label}</span>
      <span className="font-medium tabular-nums text-[#292437]">{value}</span>
    </div>
  );
}