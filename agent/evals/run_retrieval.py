import json
from agent.retrieval.retrieval import retrieve

mp = json.load(open("agent/evals/book_retrieval_map_v2.json", encoding="utf-8"))
dev = ["Q02", "Q03", "Q08", "Q10"]   # the questions we are allowed to look at

results = {}
for q in dev:
    question = mp["questions"][q]["question"]
    res = retrieve(question, top_sections=25, complete=False)
    results[q] = [{"chapter": r["chapter"], "section": r["section"]} for r in res]
    print(q, "done")

json.dump(results, open("agent/evals/results.json", "w", encoding="utf-8"), indent=1)
mp["questions"] = {q: mp["questions"][q] for q in dev}
json.dump(mp, open("agent/evals/map_dev.json", "w", encoding="utf-8"), indent=1)