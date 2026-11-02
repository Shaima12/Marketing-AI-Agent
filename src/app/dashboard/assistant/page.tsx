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
    .select("id, name, description, website_url, industry, business_model, positioning, customer, brand_voice, market, marketing, constraints, measurement")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { data: conversations } = brand
    ? await supabase
        .from("conversations")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .eq("brand_id", brand.id)
        .order("updated_at", { ascending: false })
        .limit(20)
    : { data: [] };

  const currentConversation = conversations?.[0] || null;
  const { data: messages } = currentConversation
    ? await supabase
        .from("messages")
        .select("id, role, content")
        .eq("conversation_id", currentConversation.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <BrandAssistant
      brand={brand}
      conversations={conversations || []}
      initialConversationId={currentConversation?.id || null}
      initialMessages={(messages || []).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      }))}
    />
  );
}
