from agent.retrieval.retrieval import retrieve

q = "Did my July sale actually work?"
res = retrieve(q, pool=100, top_sections=60)
names = [r["section"] for r in res]
for target in ("Promotion Measurement Windows", "Pull-Forward and Post-Promotion Dips",
               "Measuring a Promotion: Baseline, Lift and Incremental Profit",
               "Cannibalization and Customer Mix in Promotions"):
    print(target, "->", names.index(target) + 1 if target in names else "NOT in top 60")