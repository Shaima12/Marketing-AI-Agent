import ssl
from urllib.parse import urlparse, unquote
import pg8000.native
from agent.config.settings import STATEMENT_TIMEOUT_MS, ROW_CAP
from agent.data.platform_db import platform
from agent.data.credentials import decrypt


def get_connection(brand_id: str) -> dict:
    """Latest connection of this brand whose agent role is ready."""
    conns = (platform().table("data_connections").select("*")
             .eq("brand_id", brand_id).order("created_at", desc=True).execute().data)
    for c in conns:
        s = (platform().table("data_connection_secrets").select("*")
             .eq("connection_id", c["id"]).execute().data)
        if s and s[0].get("agent_ready_at"):
            return {**c, "secret": s[0]}
    raise RuntimeError("This brand has not finished database setup.")


def _login(c: dict) -> tuple[str, str]:
    user = c["secret"]["agent_username"]
    # Supabase pooler logins look like  role.<project-ref>
    if "pooler.supabase.com" in c["host"] and "." in c["username"]:
        user = f"{user}.{c['username'].split('.', 1)[1]}"
    return user, decrypt(c["secret"]["agent_secret"])


def run_readonly(ctx, sql: str, limit: int = ROW_CAP) -> list[dict]:
    c = get_connection(ctx.brand_id)
    user, password = _login(c)

    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE   # tighten later with the Supabase CA cert

    conn = pg8000.native.Connection(
        user=user, password=password, host=c["host"], port=int(c["port"]),
        database=c["database_name"], ssl_context=ssl_ctx,
        timeout=STATEMENT_TIMEOUT_MS / 1000,
    )
    try:
        conn.run("START TRANSACTION READ ONLY")
        conn.run(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}")
        rows = conn.run(f"SELECT * FROM ({sql}) q LIMIT {int(limit)}")
        cols = [col["name"] for col in conn.columns]
        conn.run("ROLLBACK")
        return [dict(zip(cols, r)) for r in rows]
    finally:
        conn.close()