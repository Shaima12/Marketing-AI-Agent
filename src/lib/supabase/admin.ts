import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = "https://uicrvlpymhcwaowweyuu.supabase.co";
  const secretKey = "sb_secret_89YivfsSYrtAmK1KB2xf5w_ICGPdKls";

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!secretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY");
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}