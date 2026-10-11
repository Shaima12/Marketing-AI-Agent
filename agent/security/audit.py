import json, time, pathlib
LOG = pathlib.Path("audit.log")

def audit(ctx, sql, rows=None, error=None):
    with LOG.open("a") as f:
        f.write(json.dumps({"t": time.time(), "brand": ctx.brand_id,
                            "sql": sql, "rows": rows, "error": error}) + "\n")