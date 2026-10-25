KNOWLEDGE = {k: "" for k in ["KB2", "KB3", "KB5", "KB8", "KB15", "KB18"]}

ARGS = {
    "actions": [
        "Focus acquisition and VIP retention efforts on organic search, email, and referral channels while pulling back paid social spend for top-customer acquisition.",
        "Engage top customers with outerwear (Jackets) storytelling, early access, and care/repair guides rather than price promotions, respecting the brand discount policy.",
        "Target the 50 at-risk and 25 cooling top-decile customers with service-oriented check-ins, product care support, or curated replenishment before churn solidifies.",
    ],
    "summary": (
        "The brand's best customers are the 502 customers in the top decile, who account for 619181.90 in net revenue (38.35% revenue share) and 352272.90 in gross profit (38.55% profit share). "
        "They average 8.76 orders with an AOV of 140.72, showing strong organic affinity (organic_search, email_signup, and referral represent 57.57% of their acquisition, while paid_social represents only 7.77%) and heavy demand for Jackets (49.59% of net revenue). "
        "They rarely rely on discounts (only 15.80% of orders use discounts) and are highly engaged brand advocates (95.62% review rate). "
        "To keep them, the brand should avoid heavy discounting, prioritize service-driven engagement, and target the 50 at-risk and 25 cooling customers who represent 78805.95 in net revenue before they lapse. "
        "Counter-evidence: While 427 top-decile customers remain active, 14.94% are already cooling or at-risk, and customer review ratings are virtually identical between segments (4.16 vs 4.14), showing product satisfaction alone does not prevent churn. "
        "Assumptions: Top decile defined by net revenue ranking over non-internal customers with delivered orders per business glossary settings."
    ),
    "cannot_determine": [
        "Direct competitor pricing or comparative market retention benchmarks are not collected in the database.",
        "Marketing acquisition spend for pre-2025 legacy customers is not available in the database.",
    ],
    "findings": [
        {"evidence_ids": ["ev_1"], "claim": "The top decile comprises 502 customers who generated 619181.90 in net revenue (38.35% revenue share) and 352272.90 in gross profit (38.55% profit share) across 4400 orders."},
        {"evidence_ids": ["ev_1"], "claim": "Top decile customers average 8.76 orders per customer and an AOV of 140.72 with a realized margin of 56.89%, compared to 2.41 orders, an AOV of 91.60, and a realized margin of 56.41% for the rest of customers."},
        {"evidence_ids": ["ev_2"], "claim": "The primary acquisition channels for top decile customers are organic_search (123 customers, 24.50%), email_signup (93 customers, 18.53%), and referral (73 customers, 14.54%), whereas paid_social accounts for only 39 customers (7.77%)."},
        {"evidence_ids": ["ev_2"], "claim": "In contrast, paid_social is the largest acquisition channel for the rest of customers, accounting for 1185 customers (26.27%)."},
        {"evidence_ids": ["ev_3"], "claim": "Jackets represent the dominant product category for top decile customers, generating 307044.20 in net revenue (49.59% category share), followed by Hoodies at 109165.60 (17.63%) and Backpacks at 84461.60 (13.64%)."},
        {"evidence_ids": ["ev_3"], "claim": "Top decile orders exhibit low discount reliance, with 695 discounted orders out of 4400 (15.80%) and an average discount percentage of 2.63%, compared to 2624 discounted orders out of 10867 (24.15%) and an average discount of 4.56% among the rest of customers."},
        {"evidence_ids": ["ev_1", "ev_3"], "claim": "Among the 502 top decile customers, 480 customers (95.62%) submitted reviews across 2233 reviews with an average rating of 4.16, compared to a 55.66% reviewer rate and 4.14 average rating for the rest of customers."},
        {"evidence_ids": ["ev_4"], "claim": "Within the top decile, 427 customers (85.06%) are active with 540375.95 in net revenue, while 50 customers (9.96%) representing 47563.50 in net revenue are at_risk (average recency of 121.9 days), and 25 customers (4.98%) representing 31242.45 in net revenue are cooling (average recency of 62.3 days)."},
    ],
    "knowledge_citations": ["KB2", "KB3", "KB5", "KB8", "KB15", "KB18"],
}
EVIDENCE = {
    "ev_1": {"result": {"row_count": 3, "rows": [
        {"segment": "Top Decile", "customer_count": 502, "customer_share_pct": "10.01",
         "total_orders": "4400", "order_share_pct": "28.82", "total_net_revenue": "619181.90",
         "revenue_share_pct": "38.35", "total_gross_profit": "352272.90", "profit_share_pct": "38.55",
         "avg_revenue_per_customer": "1233.43", "avg_orders_per_customer": "8.76",
         "aov": "140.72", "realized_margin_pct": "56.89"},
        {"segment": "Rest of Customers", "customer_count": 4511, "customer_share_pct": "89.99",
         "total_orders": "10867", "order_share_pct": "71.18", "total_net_revenue": "995445.65",
         "revenue_share_pct": "61.65", "total_gross_profit": "561483.65", "profit_share_pct": "61.45",
         "avg_revenue_per_customer": "220.67", "avg_orders_per_customer": "2.41",
         "aov": "91.60", "realized_margin_pct": "56.41"},
        {"segment": "Total", "customer_count": 5013, "customer_share_pct": "100.00",
         "total_orders": "15267", "order_share_pct": "100.00", "total_net_revenue": "1614627.55",
         "revenue_share_pct": "100.00", "total_gross_profit": "913756.55", "profit_share_pct": "100.00",
         "avg_revenue_per_customer": "322.09", "avg_orders_per_customer": "3.05",
         "aov": "105.76", "realized_margin_pct": "56.59"},
    ]}},
    "ev_2": {"result": {"row_count": 14, "rows": [
        {"segment": "Rest of Customers", "acquisition_channel": "paid_social", "customer_count": 1185, "channel_share_pct": "26.27"},
        {"segment": "Top Decile", "acquisition_channel": "organic_search", "customer_count": 123, "channel_share_pct": "24.50"},
        {"segment": "Top Decile", "acquisition_channel": "email_signup", "customer_count": 93, "channel_share_pct": "18.53"},
        {"segment": "Top Decile", "acquisition_channel": "referral", "customer_count": 73, "channel_share_pct": "14.54"},
        {"segment": "Top Decile", "acquisition_channel": "paid_social", "customer_count": 39, "channel_share_pct": "7.77"},
    ]}},
    "ev_3": {"result": {"row_count": 16, "rows": [
        {"metric_type": "category", "segment": "Top Decile", "val1": "307044.20", "val2": "49.59", "val3": "2125", "text_val": "Jackets"},
        {"metric_type": "category", "segment": "Top Decile", "val1": "109165.60", "val2": "17.63", "val3": "1530", "text_val": "Hoodies"},
        {"metric_type": "category", "segment": "Top Decile", "val1": "84461.60", "val2": "13.64", "text_val": "Backpacks"},
        {"metric_type": "discount", "segment": "Top Decile", "val1": "4400", "val2": "695", "val3": "15.80", "val4": "2.63"},
        {"metric_type": "discount", "segment": "Rest of Customers", "val1": "10867", "val2": "2624", "val3": "24.15", "val4": "4.56"},
        {"metric_type": "review", "segment": "Top Decile", "val1": "2233", "val2": "4.16", "val3": "95.62", "val4": "480"},
        {"metric_type": "review", "segment": "Rest of Customers", "val1": "4159", "val2": "4.14", "val3": "55.66", "val4": "2511"},
    ]}},
    "ev_4": {"result": {"row_count": 3, "rows": [
        {"status_cadence_based": "active", "customer_count": 427, "customer_pct": "85.06",
         "total_net_revenue": "540375.95", "revenue_pct": "87.27", "avg_recency_days": "20.4",
         "median_recency_days": "17.0", "avg_median_gap_days": "35.6", "overall_median_gap_days": "30.0"},
        {"status_cadence_based": "at_risk", "customer_count": 50, "customer_pct": "9.96",
         "total_net_revenue": "47563.50", "revenue_pct": "7.68", "avg_recency_days": "121.9",
         "median_recency_days": "114.5", "avg_median_gap_days": "33.1", "overall_median_gap_days": "29.5"},
        {"status_cadence_based": "cooling", "customer_count": 25, "customer_pct": "4.98",
         "total_net_revenue": "31242.45", "revenue_pct": "5.05", "avg_recency_days": "62.3",
         "median_recency_days": "58.0", "avg_median_gap_days": "31.6", "overall_median_gap_days": "29.0"},
    ]}},
}