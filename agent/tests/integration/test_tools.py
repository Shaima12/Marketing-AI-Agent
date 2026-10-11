import os, json, pytest
from agent.security.context import TenantContext
from agent.tools.run_sql import make_run_sql
from agent.tools.get_schema import make_get_schema

BRAND = os.getenv("TEST_BRAND_ID")
pytestmark = pytest.mark.skipif(not BRAND, reason="set TEST_BRAND_ID")

ctx = TenantContext(brand_id=BRAND) if BRAND else None
run_sql = make_run_sql(ctx) if BRAND else None

Q05 = """SELECT to_char(o.order_date,'MM') AS month,
 round(sum(i.quantity*i.unit_price)/count(DISTINCT o.order_date)) AS revenue_per_day
 FROM orders o JOIN order_items i USING (order_id) JOIN customers c USING (customer_id)
 WHERE o.status='delivered' AND NOT c.is_internal
 AND o.order_date BETWEEN '2025-02-01' AND '2025-03-31' GROUP BY 1 ORDER BY 1"""

def test_schema_carries_owner_rules():
    out = make_get_schema(ctx).invoke({})
    assert "delivered" in out and "is_internal" in out

def test_q05_matches_gold():
    rows = run_sql.invoke({"sql": Q05})["rows"]
    per_day = {r["month"]: float(r["revenue_per_day"]) for r in rows}
    assert abs(per_day["02"] - 3343) <= 1 and abs(per_day["03"] - 3008) <= 1

def test_result_is_json_serializable():
    json.dumps(run_sql.invoke({"sql": "SELECT * FROM products"}), default=str)

def test_row_cap():
    assert run_sql.invoke({"sql": "SELECT * FROM generate_series(1,1000)"})["row_count"] == 200

@pytest.mark.parametrize("bad", ["DELETE FROM orders", "SELECT 1; SELECT 2",
                                 "SELECT * FROM information_schema.tables"])
def test_bad_sql_rejected(bad):
    with pytest.raises(Exception):
        run_sql.invoke({"sql": bad})