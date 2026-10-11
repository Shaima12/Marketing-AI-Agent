from agent.data.platform_db import platform
from agent.data.connections import get_connection

def schema_text(brand_id: str) -> str:
    conn = get_connection(brand_id)
    tables = (platform().table("data_connection_tables")
              .select("id,table_schema,table_name,description")
              .eq("connection_id", conn["id"]).execute().data)
    out = []
    for t in tables:
        cols = (platform().table("data_connection_columns")
                .select("column_name,data_type,description")
                .eq("table_id", t["id"]).execute().data)
        out.append(f"TABLE {t['table_schema']}.{t['table_name']}: {t['description']}")
        for c in cols:
            d = f" - {c['description']}" if c.get("description") else ""
            out.append(f"  {c['column_name']} ({c['data_type']}){d}")
    return "\n".join(out)