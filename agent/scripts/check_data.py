import sys
from agent.security.context import TenantContext
from agent.data.introspection import schema_text
from agent.data.connections import run_readonly

ctx = TenantContext(brand_id=sys.argv[1])
print(schema_text(ctx.brand_id), "\n")

print(run_readonly(ctx, """
SELECT to_char(o.order_date,'MM') AS month,
       round(sum(i.quantity*i.unit_price)/count(DISTINCT o.order_date)) AS revenue_per_day
FROM orders o JOIN order_items i USING (order_id) JOIN customers c USING (customer_id)
WHERE o.status='delivered' AND NOT c.is_internal
  AND o.order_date BETWEEN '2025-02-01' AND '2025-03-31'
GROUP BY 1 ORDER BY 1"""))

for bad in ["DELETE FROM orders", "SELECT pg_sleep(30)"]:
    try:
        run_readonly(ctx, bad)
        print("PROBLEM, this should have failed:", bad)
    except Exception as e:
        print("blocked by the database:", type(e).__name__)