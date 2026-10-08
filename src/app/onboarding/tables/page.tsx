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

export default function TablesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tables, setTables] = useState<DiscoveredTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(
    new Set()
  );

  const [descriptions, setDescriptions] = useState<
    Record<string, string>
  >({});
  const [columnDescriptions, setColumnDescriptions] = useState<
    Record<string, string>
  >({});

  const [connectionId, setConnectionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // -------------------------------------------------------------
  // Load discovered tables
  // -------------------------------------------------------------

  useEffect(() => {
    async function load() {
      try {
        // -------------------------------------------------------
        // 1. Authenticate
        // -------------------------------------------------------

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/sign-in");
          return;
        }

        // -------------------------------------------------------
        // 2. Get user's brand
        // -------------------------------------------------------

        const { data: brand, error: brandError } = await supabase
          .from("brands")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (brandError) {
          console.error(
            "[TABLES] Failed to load brand:",
            brandError
          );

          setError(
            `Unable to load brand: ${brandError.message}`
          );

          setLoading(false);
          return;
        }

        if (!brand) {
          setError("Brand not found.");
          setLoading(false);
          return;
        }

        console.log("[TABLES] Brand:", brand);

        // -------------------------------------------------------
        // 3. Get latest data connection + discovery
        // -------------------------------------------------------

        const { data: connection, error: connectionError } =
          await supabase
            .from("data_connections")
            .select("id, discovered_tables")
            .eq("brand_id", brand.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (connectionError) {
          console.error(
            "[TABLES] Failed to load data connection:",
            connectionError
          );

          setError(
            `Unable to load data connection: ${connectionError.message}`
          );

          setLoading(false);
          return;
        }

        if (!connection) {
          setError("No data connection found.");
          setLoading(false);
          return;
        }

        console.log(
          "[TABLES] Data connection:",
          connection
        );

        setConnectionId(connection.id);

        // -------------------------------------------------------
        // 4. Load temporary discovered tables
        // -------------------------------------------------------

        const discoveredTables =
          (connection.discovered_tables as
            | DiscoveredTable[]
            | null) ?? [];

        console.log(
          "[TABLES] Discovered client database tables:",
          discoveredTables
        );

        if (discoveredTables.length === 0) {
          setError(
            "No tables were discovered from the connected database."
          );

          setLoading(false);
          return;
        }

        setTables(discoveredTables);

        // -------------------------------------------------------
        // 5. Initialize descriptions
        // -------------------------------------------------------

        const initialDescriptions: Record<string, string> = {};

        for (const table of discoveredTables) {
          const key = `${table.table_schema}.${table.table_name}`;

          initialDescriptions[key] =
            table.description ?? "";
        }

        setDescriptions(initialDescriptions);
        setLoading(false);
      } catch (err) {
        console.error(
          "[TABLES] Unexpected error:",
          err
        );

        setError(
          "Something went wrong while loading the tables."
        );

        setLoading(false);
      }
    }

    load();
  }, [router, supabase]);

  // -------------------------------------------------------------
  // Toggle table selection
  // -------------------------------------------------------------

  function toggleTable(table: DiscoveredTable) {
    const key = `${table.table_schema}.${table.table_name}`;

    setSelectedTables((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  // -------------------------------------------------------------
  // Update table description
  // -------------------------------------------------------------

  function updateDescription(
    table: DiscoveredTable,
    value: string
  ) {
    const key = `${table.table_schema}.${table.table_name}`;

    setDescriptions((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateColumnDescription(
    table: DiscoveredTable,
    column: DiscoveredColumn,
    value: string
  ) {
    const key = `${table.table_schema}.${table.table_name}::${column.name}`;

    setColumnDescriptions((current) => ({
      ...current,
      [key]: value,
    }));
  }

  // -------------------------------------------------------------
  // Save ONLY selected tables
  // -------------------------------------------------------------

  async function handleContinue() {
    setError("");

    // -----------------------------------------------------------
    // 1. Validate selection
    // -----------------------------------------------------------

    if (selectedTables.size === 0) {
      setError("Please select at least one table.");
      return;
    }

    if (!connectionId) {
      setError("No database connection found.");
      return;
    }

    // -----------------------------------------------------------
    // 2. Get ONLY selected tables
    // -----------------------------------------------------------

    const selectedSourceTables = tables.filter((table) =>
      selectedTables.has(
        `${table.table_schema}.${table.table_name}`
      )
    );

    if (selectedSourceTables.length === 0) {
      setError("No valid tables were selected.");
      return;
    }

    // -----------------------------------------------------------
    // 3. Validate descriptions
    // -----------------------------------------------------------

    for (const table of selectedSourceTables) {
      const key = `${table.table_schema}.${table.table_name}`;

      const description =
        descriptions[key]?.trim() ?? "";

      if (!description) {
        setError(
          `Please add a description for ${table.table_schema}.${table.table_name}.`
        );

        return;
      }
    }

    setSaving(true);

    try {
      // ---------------------------------------------------------
      // 4. Build ONLY selected table rows
      // ---------------------------------------------------------

      const selectedRows = selectedSourceTables.map(
        (table) => {
          const key = `${table.table_schema}.${table.table_name}`;

          return {
            connection_id: connectionId,
            table_schema: table.table_schema,
            table_name: table.table_name,
            description: descriptions[key].trim(),
            enabled: true,
          };
        }
      );

      console.log(
        "[TABLES] ONLY selected tables will be saved:",
        selectedRows
      );

      console.log(
        "[TABLES] Selected table count:",
        selectedRows.length,
        "/ discovered:",
        tables.length
      );

      // ---------------------------------------------------------
      // 5. Insert ONLY selected tables
      // ---------------------------------------------------------

      const {
        data: insertedTables,
        error: insertError,
      } = await supabase
        .from("data_connection_tables")
        .insert(selectedRows)
        .select("id, table_schema, table_name");

      if (insertError) {
        console.error(
          "[TABLES] Failed to save selected tables:",
          insertError
        );

        setError(
          `Failed to save selected tables: ${insertError.message}`
        );

        setSaving(false);
        return;
      }

      console.log(
        "[TABLES] Selected tables successfully saved:",
        insertedTables
      );

      // ---------------------------------------------------------
      // 6. Save columns ONLY for selected tables
      // ---------------------------------------------------------

      for (const insertedTable of insertedTables ?? []) {
        const sourceTable = selectedSourceTables.find(
          (table) =>
            table.table_schema ===
              insertedTable.table_schema &&
            table.table_name ===
              insertedTable.table_name
        );

        if (!sourceTable) {
          console.warn(
            "[TABLES] Source table not found:",
            insertedTable
          );

          continue;
        }

        if (sourceTable.columns.length === 0) {
          console.log(
            "[TABLES] No columns to save for:",
            insertedTable.table_name
          );

          continue;
        }

        // IMPORTANT:
        // data_connection_columns does NOT have ordinal_position.
        // Only insert columns that actually exist in the table.

        const columnRows = sourceTable.columns.map(
          (column) => {
            const key = `${sourceTable.table_schema}.${sourceTable.table_name}::${column.name}`;

            return {
              table_id: insertedTable.id,
              column_name: column.name,
              data_type: column.data_type,
              is_nullable: column.is_nullable,
              is_primary_key: column.is_primary_key,
              description: columnDescriptions[key]?.trim() || null,
              selected: true,
            };
          }
        );

        console.log(
          `[TABLES] Saving ${columnRows.length} columns for ${insertedTable.table_schema}.${insertedTable.table_name}`
        );

        const { error: columnsError } =
          await supabase
            .from("data_connection_columns")
            .insert(columnRows);

        if (columnsError) {
          console.error(
            `[TABLES] Failed to save columns for ${insertedTable.table_name}:`,
            columnsError
          );

          setError(
            `Failed to save columns for ${insertedTable.table_name}: ${columnsError.message}`
          );

          setSaving(false);
          return;
        }
      }

      // ---------------------------------------------------------
      // 7. Clear temporary discovery data
      // ---------------------------------------------------------

      const { error: clearError } = await supabase
        .from("data_connections")
        .update({
          discovered_tables: null,
        })
        .eq("id", connectionId);

      if (clearError) {
        console.error(
          "[TABLES] Failed to clear discovery data:",
          clearError
        );

        setError(
          `Failed to finalize database setup: ${clearError.message}`
        );

        setSaving(false);
        return;
      }

      console.log(
        "[TABLES] Temporary discovery data cleared."
      );

      // ---------------------------------------------------------
      // 8. Update onboarding progress
      // ---------------------------------------------------------

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            onboarding_step: 11,
          })
          .eq("id", user.id);

        if (profileError) {
          console.error(
            "[TABLES] Failed to update onboarding step:",
            profileError
          );

          setError(
            `Failed to update onboarding progress: ${profileError.message}`
          );

          setSaving(false);
          return;
        }
      }

      // ---------------------------------------------------------
      // 9. Success
      // ---------------------------------------------------------

      console.log(
        "[TABLES] Table permissions saved successfully."
      );

      console.log(
        "[TABLES] Saved table count:",
        insertedTables?.length ?? 0
      );

      router.push("/onboarding/channels");
    } catch (err) {
      console.error(
        "[TABLES] Save error:",
        err
      );

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

        <p className="mt-3 mb-10 text-gray-500">
          Select the business tables that the AI data analyst
          is allowed to access and describe what each selected
          table contains.
        </p>

        {tables.length === 0 ? (
          <div className="rounded-2xl border border-[#e8d4f1] bg-[#faf7fc] p-8 text-center">
            <div className="text-3xl">◌</div>

            <h2 className="mt-3 font-semibold">
              No tables discovered
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              We could not find any accessible tables in the
              connected database.
            </p>
          </div>
        ) : (
          <>
            {/* Selection count */}

            <div className="mb-5 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {selectedTables.size} of {tables.length} tables
                selected
              </div>

              <div className="text-xs text-gray-400">
                Only selected tables will be accessible to the
                AI data analyst.
              </div>
            </div>

            {/* Tables */}

            <div className="space-y-4">
              {tables.map((table) => {
                const key = `${table.table_schema}.${table.table_name}`;

                const selected =
                  selectedTables.has(key);

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
                      onClick={() =>
                        toggleTable(table)
                      }
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}

                        <div
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                            selected
                              ? "border-[#b57fdc] bg-[#b57fdc]"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {selected && (
                            <span className="text-sm text-white">
                              ✓
                            </span>
                          )}
                        </div>

                        {/* Table information */}

                        <div>
                          <div className="font-semibold">
                            {table.table_schema}.
                            {table.table_name}
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {table.table_type}

                            {table.columns.length > 0 &&
                              ` · ${table.columns.length} columns`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description */}

                    {selected && (
                      <div className="mt-5 border-t border-[#e8d4f1] pt-5">
                        <label
                          htmlFor={`description-${key}`}
                          className="block text-sm font-semibold"
                        >
                          Table description
                        </label>

                        <p className="mt-1 text-xs text-gray-500">
                          Describe what this table contains and
                          how the AI data analyst should understand
                          it.
                        </p>

                        <textarea
                          id={`description-${key}`}
                          value={
                            descriptions[key] ?? ""
                          }
                          onChange={(event) =>
                            updateDescription(
                              table,
                              event.target.value
                            )
                          }
                          onClick={(event) =>
                            event.stopPropagation()
                          }
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
                              Column descriptions
                            </h3>
                            <div className="mt-3 space-y-4">
                              {table.columns.map((column) => {
                                const columnKey = `${key}::${column.name}`;
                                const inputId = `column-description-${columnKey}`;

                                return (
                                  <div
                                    key={column.name}
                                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-start"
                                  >
                                    <label
                                      htmlFor={inputId}
                                      className="pt-2 text-sm"
                                    >
                                      <span className="font-medium">{column.name}</span>
                                      <span className="ml-2 text-xs text-gray-400">
                                        {column.data_type}
                                        {column.is_primary_key ? " · Primary key" : ""}
                                      </span>
                                    </label>
                                    <textarea
                                      id={inputId}
                                      value={columnDescriptions[columnKey] ?? ""}
                                      onChange={(event) =>
                                        updateColumnDescription(
                                          table,
                                          column,
                                          event.target.value
                                        )
                                      }
                                      onClick={(event) => event.stopPropagation()}
                                      placeholder={`Describe ${column.name}`}
                                      rows={2}
                                      maxLength={1000}
                                      className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#b57fdc] focus:ring-2 focus:ring-[#e8d4f1]"
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
          </div>
        )}

        {/* Actions */}

        <div className="mt-8 flex justify-between border-t border-[#e8d4f1] pt-7">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/onboarding/business-data"
              )
            }
            disabled={saving}
            className="rounded-xl px-5 py-3 text-sm text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
          >
            ← Back
          </button>

          <button
            type="button"
            onClick={handleContinue}
            disabled={
              saving ||
              tables.length === 0 ||
              selectedTables.size === 0
            }
            className="rounded-xl bg-[#2a073c] px-7 py-3.5 font-semibold text-white transition hover:bg-[#3d1055] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Continue →"}
          </button>
        </div>
          </div>
        </section>
      </div>
    </main>
  );
}
