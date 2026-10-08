import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return (
    <DashboardShell
      userId={user.id}
      fullName={user.user_metadata?.full_name || "Your account"}
      email={user.email || ""}
      brandName={brand?.name || "Your brand"}
    >
      {children}
    </DashboardShell>
  );
}