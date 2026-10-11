from langchain_core.tools import tool
from agent.data.connections import run_readonly
from agent.security.sql_guard import check_sql
from agent.security.audit import audit

def make_run_sql(ctx):
    @tool
    def run_sql(sql: str) -> dict:
        """Run ONE read-only SELECT on the allowed tables. Do all arithmetic in SQL
        (sums, ratios, percentages). Results are capped at 200 rows."""
        try:
            rows = run_readonly(ctx, check_sql(sql))
            audit(ctx, sql, len(rows))
            return {"row_count": len(rows), "rows": rows}
        except Exception as e:
            audit(ctx, sql, error=str(e))
            raise
    return run_sql