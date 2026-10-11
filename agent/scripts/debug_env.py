from agent.config.settings import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
from agent.data.platform_db import platform

print("URL:", SUPABASE_URL)
print("key starts with:", SUPABASE_SERVICE_ROLE_KEY[:12], "... length", len(SUPABASE_SERVICE_ROLE_KEY))

r = platform().table("data_connection_secrets").select("connection_id,agent_ready_at").execute()
print("secrets rows visible:", r.data)