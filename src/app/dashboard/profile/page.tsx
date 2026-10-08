import { redirect } from "next/navigation";
import ProfileForm from "@/components/profile-form";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  return (
    <div className="max-w-3xl">
      <div className="border-b border-[#ded9e2] pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#816696]">
          Account
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Personal information</h1>
        <p className="mt-2 text-sm text-[#77717f]">
          Manage the details connected to your MarketingAI account.
        </p>
      </div>
      <ProfileForm
        initialName={user.user_metadata?.full_name || ""}
        email={user.email || ""}
        userId={user.id}
      />
    </div>
  );
}