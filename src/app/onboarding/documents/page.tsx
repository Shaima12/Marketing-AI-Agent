"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import OnboardingProgress from "@/components/onboarding-progress";

type DocumentRow = {
  id: string;
  user_id: string;
  brand_id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  status: string;
  created_at: string;
};

export default function DocumentsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [brandId, setBrandId] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // -------------------------------------------------------------
  // Load user + brand + documents
  // -------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        // -------------------------------------------------------
        // 1. Get authenticated user
        // -------------------------------------------------------

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        console.log("[DOCUMENTS] Auth:", {
          userId: user?.id,
          authError,
        });

        if (authError) {
          throw new Error(
            `Authentication error: ${authError.message}`
          );
        }

        if (!user) {
          router.push("/sign-in");
          return;
        }

        // -------------------------------------------------------
        // 2. Get user's brand
        // -------------------------------------------------------

        const {
          data: brand,
          error: brandError,
        } = await supabase
          .from("brands")
          .select("id, user_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        console.log("[DOCUMENTS] Brand:", {
          brand,
          brandError,
        });

        if (brandError) {
          throw new Error(
            `Unable to load brand: ${brandError.message}`
          );
        }

        if (!brand) {
          throw new Error("No brand found for this account.");
        }

        // Extra safety check
        if (brand.user_id !== user.id) {
          throw new Error(
            "The selected brand does not belong to the authenticated user."
          );
        }

        if (cancelled) return;

        setBrandId(brand.id);

        // -------------------------------------------------------
        // 3. Load documents
        // -------------------------------------------------------

        const {
          data: documentRows,
          error: documentsError,
        } = await supabase
          .from("documents")
          .select("*")
          .eq("brand_id", brand.id)
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          });

        if (documentsError) {
          throw new Error(
            `Unable to load documents: ${documentsError.message}`
          );
        }

        console.log(
          "[DOCUMENTS] Documents:",
          documentRows
        );

        if (!cancelled) {
          setDocuments(
            (documentRows ?? []) as DocumentRow[]
          );
        }
      } catch (err) {
        console.error(
          "[DOCUMENTS] Load error:",
          err
        );

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load documents."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  // -------------------------------------------------------------
  // Upload document
  // -------------------------------------------------------------

  async function uploadDocument() {
    setError("");

    // -----------------------------------------------------------
    // Validation
    // -----------------------------------------------------------

    if (!file) {
      setError("Please select a file.");
      return;
    }

    if (!brandId) {
      setError("No brand found.");
      return;
    }

    setUploading(true);

    let uploadedPath: string | null = null;

    try {
      // ---------------------------------------------------------
      // 1. Get authenticated user
      // ---------------------------------------------------------

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      console.log("[DOCUMENTS] Upload auth:", {
        userId: user?.id,
        authError,
      });

      if (authError) {
        throw new Error(
          `Authentication error: ${authError.message}`
        );
      }

      if (!user) {
        router.push("/sign-in");
        return;
      }

      // ---------------------------------------------------------
      // 2. Verify brand belongs to user
      // ---------------------------------------------------------

      const {
        data: brand,
        error: brandError,
      } = await supabase
        .from("brands")
        .select("id, user_id")
        .eq("id", brandId)
        .eq("user_id", user.id)
        .single();

      console.log("[DOCUMENTS] Upload brand:", {
        brand,
        brandError,
      });

      if (brandError || !brand) {
        throw new Error(
          "The selected brand does not belong to the authenticated user."
        );
      }

      // ---------------------------------------------------------
      // 3. Create storage path
      // ---------------------------------------------------------

      const safeFileName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      uploadedPath = `${user.id}/${brand.id}/${crypto.randomUUID()}-${safeFileName}`;

      console.log(
        "[DOCUMENTS] Storage path:",
        uploadedPath
      );

      // ---------------------------------------------------------
      // 4. Upload file to Storage
      // ---------------------------------------------------------

      const {
        error: storageError,
      } = await supabase.storage
        .from("brand-documents")
        .upload(uploadedPath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (storageError) {
        console.error(
          "[DOCUMENTS] Storage upload error:",
          storageError
        );

        throw new Error(
          `File upload failed: ${storageError.message}`
        );
      }

      console.log(
        "[DOCUMENTS] File uploaded successfully."
      );

      // ---------------------------------------------------------
      // 5. Insert document metadata
      // ---------------------------------------------------------

      const documentPayload = {
        user_id: user.id,
        brand_id: brand.id,
        title: title.trim() || file.name,
        description: description.trim() || null,
        file_path: uploadedPath,
        file_type: file.type || null,
        file_size: file.size,
        status: "pending",
      };

      console.log(
        "[DOCUMENTS] Inserting document:",
        documentPayload
      );

      const {
        data,
        error: dbError,
      } = await supabase
        .from("documents")
        .insert(documentPayload)
        .select("*")
        .single();

      if (dbError) {
        console.error(
          "[DOCUMENTS] Database insert error:",
          dbError
        );

        // -------------------------------------------------------
        // Roll back Storage upload
        // -------------------------------------------------------

        if (uploadedPath) {
          const { error: removeError } =
            await supabase.storage
              .from("brand-documents")
              .remove([uploadedPath]);

          if (removeError) {
            console.error(
              "[DOCUMENTS] Failed to rollback uploaded file:",
              removeError
            );
          }
        }

        throw new Error(
          `Failed to save document metadata: ${dbError.message}`
        );
      }

      console.log(
        "[DOCUMENTS] Document saved successfully:",
        data
      );

      // ---------------------------------------------------------
      // 6. Update UI
      // ---------------------------------------------------------

      setDocuments((current) => [
        data as DocumentRow,
        ...current,
      ]);

      setFile(null);
      setTitle("");
      setDescription("");

      // Reset file input
      const fileInput =
        document.getElementById(
          "document-file"
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (err) {
      console.error(
        "[DOCUMENTS] Upload error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload document."
      );
    } finally {
      setUploading(false);
    }
  }

  // -------------------------------------------------------------
  // Continue
  // -------------------------------------------------------------

  async function handleContinue() {
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { error: profileError } =
        await supabase
          .from("profiles")
          .update({
            onboarding_step: 13,
          })
          .eq("id", user.id);

      if (profileError) {
        console.error(
          "[DOCUMENTS] Profile update error:",
          profileError
        );

        setError(
          `Failed to update onboarding progress: ${profileError.message}`
        );

        return;
      }

      router.push("/onboarding/review");
    } catch (err) {
      console.error(
        "[DOCUMENTS] Continue error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to continue."
      );
    }
  }

  // -------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-[#2a073c]">
        <div className="text-sm text-gray-500">
          Loading documents...
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------
  // UI
  // -------------------------------------------------------------

  return (
    <main className="min-h-screen bg-white text-[#2a073c]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <OnboardingProgress step={12} />
        <section className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-3xl">

        <p className="text-sm font-semibold uppercase tracking-wider text-[#b57fdc]">
          Step 12
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Add brand knowledge
        </h1>

        <p className="mt-3 mb-10 text-gray-500">
          Upload guidelines, strategy documents, product
          information, policies and other knowledge your AI
          should understand.
        </p>

        {/* --------------------------------------------------- */}
        {/* Upload form */}
        {/* --------------------------------------------------- */}

        <div className="rounded-2xl border border-[#e8d4f1] p-6">

          {/* Title */}

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Document title
            </label>

            <input
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="Example: Brand Guidelines"
              className="w-full rounded-xl border border-[#e8d4f1] px-4 py-3 outline-none focus:border-[#b57fdc] focus:ring-2 focus:ring-[#e8d4f1]"
            />
          </div>

          {/* Description */}

          <div className="mt-5">
            <label className="mb-2 block text-sm font-semibold">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="What does this document contain?"
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-[#e8d4f1] px-4 py-3 outline-none focus:border-[#b57fdc] focus:ring-2 focus:ring-[#e8d4f1]"
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {description.length}/1000
            </p>
          </div>

          {/* File */}

          <div className="mt-5">
            <label
              htmlFor="document-file"
              className="mb-2 block text-sm font-semibold"
            >
              File
            </label>

            <input
              id="document-file"
              type="file"
              accept=".pdf,.txt,.md,.doc,.docx,.json"
              onChange={(e) =>
                setFile(
                  e.target.files?.[0] ?? null
                )
              }
              className="w-full rounded-xl border border-[#e8d4f1] p-3"
            />
          </div>

          {file && (
            <div className="mt-3 rounded-xl bg-[#faf7fc] p-3">
              <p className="text-sm font-medium">
                {file.name}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          {/* Upload */}

          <button
            type="button"
            onClick={uploadDocument}
            disabled={
              !file ||
              uploading ||
              !brandId
            }
            className="mt-5 rounded-xl bg-[#2a073c] px-6 py-3 font-semibold text-white transition hover:bg-[#3d1055] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? "Uploading..."
              : "Upload document"}
          </button>

          {/* Error */}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">
                Upload failed
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* --------------------------------------------------- */}
        {/* Uploaded documents */}
        {/* --------------------------------------------------- */}

        {documents.length > 0 && (
          <div className="mt-8 space-y-3">

            <h2 className="font-semibold">
              Uploaded documents
            </h2>

            {documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {document.title}
                  </p>

                  {document.description && (
                    <p className="mt-1 text-sm text-gray-500">
                      {document.description}
                    </p>
                  )}

                  <p className="mt-1 text-xs text-gray-400">
                    {document.file_type ||
                      "Document"}
                  </p>
                </div>

                <span className="ml-4 shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs">
                  {document.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* --------------------------------------------------- */}
        {/* Navigation */}
        {/* --------------------------------------------------- */}

        <div className="mt-8 flex justify-between border-t border-[#e8d4f1] pt-7">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/onboarding/channels"
              )
            }
            disabled={uploading}
            className="rounded-xl px-5 py-3 text-sm text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
          >
            ← Back
          </button>

          <button
            type="button"
            onClick={handleContinue}
            disabled={uploading}
            className="rounded-xl bg-[#2a073c] px-7 py-3.5 font-semibold text-white transition hover:bg-[#3d1055] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue →
          </button>

        </div>
          </div>
        </section>
      </div>
    </main>
  );
}