"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfileForm({
  initialName,
  email,
  userId,
}: {
  initialName: string;
  email: string;
  userId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Your profile has been updated.");
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-7">
      <div className="grid gap-6 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div>
          <p className="text-sm font-semibold">Profile details</p>
          <p className="mt-1 text-xs leading-5 text-[#8d8494]">
            Your name is shown in your workspace.
          </p>
        </div>
        <div className="space-y-5">
          <div>
            <label htmlFor="profile-name" className="mb-2 block text-xs font-semibold text-[#655d6c]">
              Full name
            </label>
            <input
              id="profile-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-[#ddd8e1] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[#9273a7] focus:ring-2 focus:ring-[#e8d4f1]"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-2 block text-xs font-semibold text-[#655d6c]">
              Email address
            </label>
            <input
              id="profile-email"
              readOnly
              value={email}
              className="w-full rounded-lg border border-[#e8e5e9] bg-[#f6f5f6] px-3.5 py-3 text-sm text-[#817989] outline-none"
            />
            <p className="mt-1.5 text-[11px] text-[#96909a]">
              Account email changes are managed by your sign-in provider.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 border-t border-[#e7e4e9] pt-6 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div>
          <p className="text-sm font-semibold">Account</p>
          <p className="mt-1 text-xs leading-5 text-[#8d8494]">Your account identifier.</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-[#655d6c]">User ID</p>
          <p className="break-all rounded-lg bg-[#f0edf2] px-3.5 py-3 font-mono text-xs text-[#655d6c]">
            {userId}
          </p>
        </div>
      </div>

      {(message || error) && (
        <p role="status" className={`text-sm ${error ? "text-red-700" : "text-[#426344]"}`}>
          {error || message}
        </p>
      )}

      <div className="flex justify-end border-t border-[#e7e4e9] pt-5">
        <button
          type="submit"
          disabled={saving || !name.trim() || name.trim() === initialName}
          className="rounded-lg bg-[#251d31] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#3b3048] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}