"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OnboardingProgress from "@/components/onboarding-progress";

type DiscoveredColumn = {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  ordinal_position?: number;
};

type DiscoveredTable = {
  table_schema: string;
  table_name: string;
  table_type: string;
  description: string | null;
  columns: DiscoveredColumn[];
};

// Columns that look like personal data start unchecked.
const PII =
  /(email|phone|mobile|address|street|zip|postal|birth|dob|ssn|passport|card|iban|ip_?addr|password|token)/i;

export default function TablesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tables, setTables] = useState<DiscoveredTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(
    new Set()
  );

  const [descriptions, setDescriptions] = useState<Record<string, string>>(
    {}
  );
  const [columnDescriptions, setColumnDescriptions] = useState<
    Record<string, string>
  >({});
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set()
  );

  const [connectionId, setConnectionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);

  // -------------------------------------------------------------
  // Load discovered tables
  // -------------------------------------------------------------

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/sign-in");
          return;
        }

        const { data: brand, error: brandError } = await supabase
          .from("brands")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (brandError || !brand) {
          console.error("[TABLES] Failed to load brand:", brandError);
          setError(
            brandError
              ? `Unable to load brand: ${brandError.message}`
              : "Brand not found."
          );
          setLoading(false);
          return;
        }

        const { data: connection, error: connectionError } = await supabase
          .from("data_connections")
          .select("id, discovered_tables")
          .eq("brand_id", brand.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (connectionError || !connection) {
          console.error(
            "[TABLES] Failed to load data connection:",
            connectionError
          );
          setError(
            connectionError
              ? `Unable to load data connection: ${connectionError.message}`
              : "No data connection found."
          );
          setLoading(false);
          return;
        }

        setConnectionId(connection.id);

        const discoveredTables =
          (connection.discovered_tables as DiscoveredTable[] | null) ?? [];

        if (discoveredTables.length === 0) {
          setError("No tables were discovered from the connected database.");
          setLoading(false);
          return;
        }

        setTables(discoveredTables);

        // Default column selection: everything except personal-looking columns
        const defaultColumns = new Set<string>();

        for (const table of discoveredTables) {
          for (const column of table.columns) {
            if (!PII.test(column.name)) {
              defaultColumns.add(
                `${table.table_schema}.${table.table_name}::${column.name}`
              );
            }
          }
        }

        setSelectedColumns(defaultColumns);

        const initialDescriptions: Record<string, string> = {};

        for (const table of discoveredTables) {
          const key = `${table.table_schema}.${table.table_name}`;
          initialDescriptions[key] = table.description ?? "";
        }

        setDescriptions(initialDescriptions);
        setLoading(false);
      } catch (err) {
        console.error("[TABLES] Unexpected error:", err);
        setError("Something went wrong while loading the tables.");
        setLoading(false);
      }
    }

    load();
  }, [router, supabase]);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------

  function toggleTable(table: DiscoveredTable) {
    const key = `${table.table_schema}.${table.table_name}`;

    setSelectedTables((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateDescription(table: DiscoveredTable, value: string) {
    const key = `${table.table_schema}.${table.table_name}`;
    setDescriptions((current) => ({ ...current, [key]: value }));
  }

  function updateColumnDescription(
    table: DiscoveredTable,
    column: DiscoveredColumn,
    value: string
  ) {
    const key = `${table.table_schema}.${table.table_name}::${column.name}`;
    setColumnDescriptions((current) => ({ ...current, [key]: value }));
  }

  function toggleColumn(table: DiscoveredTable, column: DiscoveredColumn) {
    const key = `${table.table_schema}.${table.table_name}::${column.name}`;

    setSelectedColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // -------------------------------------------------------------
  // Finalize: the server creates the read-only role and saves everything
  // -------------------------------------------------------------

  async function handleContinue() {
    setError("");
    setExpired(false);

    if (selectedTables.size === 0) {
      setError("Please select at least one table.");
      return;
    }

    if (!connectionId) {
      setError("No database connection found.");
      return;
    }

    const selectedSourceTables = tables.filter((table) =>
      selectedTables.has(`${table.table_schema}.${table.table_name}`)
    );

    for (const table of selectedSourceTables) {
      const key = `${table.table_schema}.${table.table_name}`;

      if (!(descriptions[key]?.trim() ?? "")) {
        setError(`Please add a description for ${key}.`);
        return;
      }

      const hasColumn = table.columns.some((c) =>
        selectedColumns.has(`${key}::${c.name}`)
      );

      if (!hasColumn) {
        setError(`Select at least one column in ${key}.`);
        return;
      }
    }

    setSaving(true);

    try {
      const res = await fetch("/api/data-connections/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          tables: selectedSourceTables.map((table) => {
            const key = `${table.table_schema}.${table.table_name}`;

            return {
              schema: table.table_schema,
              name: table.table_name,
              description: descriptions[key].trim(),
              columns: table.columns.map((column) => ({
                name: column.name,
                selected: selectedColumns.has(`${key}::${column.name}`),
                description:
                  columnDescriptions[`${key}::${column.name}`] ?? "",
              })),
            };
          }),
        }),
      });

      const out = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 410) setExpired(true);

        throw new Error(
          out.error ||
            (res.status === 410
              ? "Setup session expired. Please reconnect your database."
              : "Unable to finish the database setup.")
        );
      }

      router.push("/onboarding/channels");
    } catch (err) {
      console.error("[TABLES] Finalize error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while saving."
      );
      setSaving(false);
    }
  }

  // -------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  // -------------------------------------------------------------
  // UI
  // -------------------------------------------------------------

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <OnboardingProgress step={10} />
        <section className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">
              Step 10
            </p>

            <h1 className="mt-3 text-4xl font-bold">
              Choose accessible tables
            </h1>

            <p className="mb-10 mt-3 text-gray-500">
              Select the business tables and columns that the AI data analyst
              is allowed to read, and describe what they contain. Anything you
              leave unchecked is blocked at the database level.
            </p>

            {tables.length === 0 ? (
              <div className="rounded-2xl border border-[#e8d4f1] bg-[#faf7fc] p-8 text-center">
                <div className="text-3xl">◌</div>

                <h2 className="mt-3 font-semibold">No tables discovered</h2>

                <p className="mt-2 text-sm text-gray-500">
                  We could not find any accessible tables in the connected
                  database.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {selectedTables.size} of {tables.length} tables selected
                  </div>

                  <div className="text-xs text-gray-400">
                    Only selected tables and columns will be accessible to the
                    AI data analyst.
                  </div>
                </div>

                <div className="space-y-4">
                  {tables.map((table) => {
                    const key = `${table.table_schema}.${table.table_name}`;
                    const selected = selectedTables.has(key);

                    return (
                      <div
                        key={key}
                        className={`rounded-2xl border p-5 transition ${
                          selected
                            ? "border-[#b57fdc] bg-[#e8d4f1]/30"
                            : "border-gray-200"
                        }`}
                      >
                        {/* Table header */}
                        <div
                          className="flex cursor-pointer items-start justify-between"
                          onClick={() => toggleTable(table)}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                                selected
                                  ? "border-[#b57fdc] bg-[#b57fdc]"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              {selected && (
                                <span className="text-sm text-white">✓</span>
                              )}
                            </div>

                            <div>
                              <div className="font-semibold">
                                {table.table_schema}.{table.table_name}
                              </div>

                              <div className="mt-1 text-xs text-gray-400">
                                {table.table_type}
                                {table.columns.length > 0 &&
                                  ` · ${table.columns.length} columns`}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Table description + columns */}
                        {selected && (
                          <div className="mt-5 border-t border-[#e8d4f1] pt-5">
                            <label
                              htmlFor={`description-${key}`}
                              className="block text-sm font-semibold"
                            >
                              Table description
                            </label>

                            <p className="mt-1 text-xs text-gray-500">
                              Describe what this table contains and how the AI
                              data analyst should understand it.
                            </p>

                            <textarea
                              id={`description-${key}`}
                              value={descriptions[key] ?? ""}
                              onChange={(event) =>
                                updateDescription(table, event.target.value)
                              }
                              onClick={(event) => event.stopPropagation()}
                              placeholder="Example: Customer profiles including location, demographics, registration date and customer segment."
                              rows={3}
                              maxLength={1000}
                              className="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#b57fdc] focus:ring-2 focus:ring-[#e8d4f1]"
                            />

                            <div className="mt-1 text-right text-xs text-gray-400">
                              {(descriptions[key] ?? "").length}/1000
                            </div>

                            {table.columns.length > 0 && (
                              <div className="mt-6 border-t border-gray-200 pt-5">
                                <h3 className="text-sm font-semibold">
                                  Columns the AI analyst can read
                                </h3>

                                <div className="mt-3 space-y-4">
                                  {table.columns.map((column) => {
                                    const columnKey = `${key}::${column.name}`;
                                    const inputId = `column-description-${columnKey}`;
                                    const columnSelected =
                                      selectedColumns.has(columnKey);
                                    const looksPersonal = PII.test(
                                      column.name
                                    );

                                    return (
                                      <div
                                        key={column.name}
                                        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-start"
                                      >
                                        <div className="pt-2 text-sm">
                                          <label className="flex cursor-pointer items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={columnSelected}
                                              onChange={() =>
                                                toggleColumn(table, column)
                                              }
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="h-4 w-4 accent-[#b57fdc]"
                                            />
                                            <span className="font-medium">
                                              {column.name}
                                            </span>
                                          </label>

                                          <div className="ml-6 text-xs text-gray-400">
                                            {column.data_type}
                                            {column.is_primary_key
                                              ? " · Primary key"
                                              : ""}
                                          </div>

                                          {looksPersonal && (
                                            <div className="ml-6 mt-1 text-xs text-amber-600">
                                              May contain personal data
                                            </div>
                                          )}
                                        </div>

                                        <textarea
                                          id={inputId}
                                          value={
                                            columnDescriptions[columnKey] ?? ""
                                          }
                                          onChange={(event) =>
                                            updateColumnDescription(
                                              table,
                                              column,
                                              event.target.value
                                            )
                                          }
                                          onClick={(event) =>
                                            event.stopPropagation()
                                          }
                                          disabled={!columnSelected}
                                          placeholder={
                                            columnSelected
                                              ? `Describe ${column.name}`
                                              : "Hidden from the AI analyst"
                                          }
                                          rows={2}
                                          maxLength={1000}
                                          className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#b57fdc] focus:ring-2 focus:ring-[#e8d4f1] disabled:bg-gray-50 disabled:opacity-60"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {error}

                {expired && (
                  <button
                    type="button"
                    onClick={() => router.push("/onboarding/business-data")}
                    className="mt-2 block font-semibold underline"
                  >
                    Reconnect database
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex justify-between border-t border-[#e8d4f1] pt-7">
              <button
                type="button"
                onClick={() => router.push("/onboarding/business-data")}
                disabled={saving}
                className="rounded-xl px-5 py-3 text-sm text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleContinue}
                disabled={
                  saving || tables.length === 0 || selectedTables.size === 0
                }
                className="rounded-xl bg-[#2a073c] px-7 py-3.5 font-semibold text-white transition hover:bg-[#3d1055] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Setting up access..." : "Continue →"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}