  import { redirect } from "next/navigation";
import BrandAssistant from "@/components/brand-assistant";
import { createClient } from "@/lib/supabase/server";

export default async function AssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: brand } = await supabase
    .from("brands")
    .select(
      "name, description, website_url, industry, business_model, positioning, customer, brand_voice, market, marketing, constraints, measurement"
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return <BrandAssistant brand={brand} />;
}