"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function BusinessDataPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [databaseName, setDatabaseName] = useState("postgres");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue(event?: FormEvent) {
    event?.preventDefault();

    setSaving(true);
    setError("");

    try {
      // ---------------------------------------------------------
      // Validation
      // ---------------------------------------------------------

      if (!name.trim()) {
        throw new Error("Please enter a connection name.");
      }

      if (!host.trim()) {
        throw new Error("Please enter the database host.");
      }

      const numericPort = Number(port);

      if (
        !Number.isInteger(numericPort) ||
        numericPort < 1 ||
        numericPort > 65535
      ) {
        throw new Error("Please enter a valid database port.");
      }

      if (!databaseName.trim()) {
        throw new Error("Please enter the database name.");
      }

      if (!username.trim()) {
        throw new Error("Please enter the database username.");
      }

      if (!password) {
        throw new Error("Please enter the database password.");
      }

      // ---------------------------------------------------------
      // Connect + discover database
      // ---------------------------------------------------------

      const response = await fetch("/api/data-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          databaseType: "postgresql",
          host: host.trim(),
          port: numericPort,
          databaseName: databaseName.trim(),
          username: username.trim(),
          password,
        }),
      });

      // ---------------------------------------------------------
      // Safely parse API response
      // ---------------------------------------------------------

      const contentType =
        response.headers.get("content-type") || "";

      let result: {
        error?: string;
        message?: string;
      } = {};

      if (contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const body = await response.text();

        console.error("[BUSINESS DATA] Unexpected API response:", {
          status: response.status,
          contentType,
          body: body.slice(0, 1000),
        });

        if (response.status === 404) {
          throw new Error(
            "The database connection API was not found. Check /api/data-connections."
          );
        }

        if (response.status === 405) {
          throw new Error(
            "The database connection API does not accept this request method."
          );
        }

        throw new Error(
          `The server returned an unexpected response (${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.message ||
            "Unable to connect to the database."
        );
      }

      console.log("[BUSINESS DATA] Database connected successfully.");

      // Step 10 will load the discovered tables
      router.push("/onboarding/tables");
    } catch (err) {
      console.error(
        "[BUSINESS DATA] Database connection error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the database."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout
      step={9}
      title="Connect your business data"
      subtitle="Connect your business database so your AI analyst can work with real business data."
    >
      {/* Connection name */}
      <Field
        label="Connection name"
        placeholder="Example: Nova Fashion business database"
        value={name}
        onChange={setName}
      />

      {/* Database type */}
      <div>
        <label className="mb-2 block text-sm font-semibold">
          Database type
        </label>

        <div className="rounded-xl border border-[#e8d4f1] bg-[#faf7fc] px-4 py-3.5 text-sm">
          PostgreSQL / Supabase
        </div>

        <p className="mt-2 text-xs text-gray-400">
          PostgreSQL databases are currently supported.
        </p>
      </div>

      {/* Host */}
      <Field
        label="Host"
        placeholder="db.xxxxxxxxx.supabase.co"
        value={host}
        onChange={setHost}
        mono
      />

      {/* Port + database */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Port"
          placeholder="5432"
          value={port}
          onChange={setPort}
          mono
        />

        <Field
          label="Database"
          placeholder="postgres"
          value={databaseName}
          onChange={setDatabaseName}
          mono
        />
      </div>

      {/* Username */}
      <Field
        label="Username"
        placeholder="postgres"
        value={username}
        onChange={setUsername}
        mono
      />

      {/* Password */}
      <div>
        <label className="mb-2 block text-sm font-semibold">
          Password
        </label>

        <div className="relative">
          <input
            required
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter database password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-[#e8d4f1] px-4 py-3.5 pr-20 text-sm outline-none transition focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1]"
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword((value) => !value)
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-[#faf7fc] hover:text-[#2a073c]"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {/* Security information */}
      <div className="rounded-xl border border-[#e8d4f1] bg-[#faf7fc] px-4 py-4">
        <div className="flex gap-3">
          <div className="mt-0.5 text-[#8d5aa8]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect
                x="5"
                y="10"
                width="14"
                height="10"
                rx="2"
              />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
          </div>

          <div>
            <p className="text-sm font-semibold">
              Your database should be read-only
            </p>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              The AI analyst will use this connection to inspect
              and analyze business data. It should not be allowed
              to modify your database.
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">
            Connection failed
          </p>

          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>
        </div>
      )}

      {/* Actions */}
      <Actions
        back="/onboarding/measurement"
        onContinue={handleContinue}
        saving={saving}
      />
    </Layout>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  mono = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">
        {label}
      </label>

      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-[#e8d4f1] px-4 py-3.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-[#b57fdc] focus:ring-4 focus:ring-[#e8d4f1] ${
          mono ? "font-mono" : ""
        }`}
      />
    </div>
  );
}

function Actions({
  back,
  onContinue,
  saving,
}: {
  back: string;
  onContinue: () => void;
  saving: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex justify-between border-t border-[#e8d4f1] pt-7">
      <button
        type="button"
        onClick={() => router.push(back)}
        className="rounded-xl px-5 py-3 text-sm text-gray-500 transition hover:bg-gray-100"
      >
        ← Back
      </button>

      <button
        type="button"
        onClick={onContinue}
        disabled={saving}
        className="rounded-xl bg-[#2a073c] px-7 py-3.5 font-semibold text-white transition hover:bg-[#3d1055] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Connecting..." : "Connect & Continue →"}
      </button>
    </div>
  );
}

function Layout({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
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

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-[#e8d4f1] bg-[#faf7fc] p-8 lg:block">
          <div className="mb-10 text-2xl font-bold">
            Marketing
            <span className="text-[#b57fdc]">AI</span>
          </div>

          <div className="space-y-2">
            {steps.map((stepName, i) => (
              <div
                key={stepName}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  i + 1 === step ? "bg-[#e8d4f1]" : ""
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    i + 1 < step
                      ? "bg-[#b57fdc] text-white"
                      : i + 1 === step
                        ? "bg-[#2a073c] text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i + 1 < step ? "✓" : i + 1}
                </div>

                <span
                  className={`text-sm ${
                    i + 1 === step ? "font-semibold" : ""
                  }`}
                >
                  {stepName}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">
              Step {String(step).padStart(2, "0")}
            </p>

            <h1 className="text-4xl font-bold tracking-tight">
              {title}
            </h1>

            <p className="mb-10 mt-3 text-gray-500">
              {subtitle}
            </p>

            <div className="space-y-7">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}