"""Runs the final pipeline on the 10 scenarios and prints Found / Missing per question."""
import json, re, time, subprocess, sys
from retrieval import retrieve, expand

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

MAP_PATH  = BASE_DIR / "book_retrieval_map_v2.json"
EVAL_PATH = BASE_DIR / "eval_retrieval.py"
TOP, POOL = 25, 40

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[`*_#]", "", s or "")).strip().lower()

mp = json.load(open(MAP_PATH, encoding="utf-8"))
results, rows = {}, []
tot_found = tot_all = 0

for qid, spec in mp["questions"].items():
    secs = retrieve(spec["question"], queries=expand(spec["question"]), top_sections=TOP, pool=POOL, complete=False)
    results[qid] = [{"chapter": s["chapter"], "section": s["section"]} for s in secs]
    ranked = [(norm(s["chapter"]), norm(s["section"])) for s in secs]

    found, missing = 0, []
    for p in spec["primary_sections"]:
        a, b = [norm(x) for x in p.split(" > ", 1)]
        if (a, b) in ranked:
            found += 1
        else:
            missing.append(p.split(" > ", 1)[1])
    n = len(spec["primary_sections"])
    tot_found += found; tot_all += n
    rows.append((qid, f"{found}/{n}", ", ".join(missing) or "none"))
    print(f"{qid} done", flush=True)
    time.sleep(3)                                          # stay under the API rate limits

print("\nQ\tFound\tMissing")
for r in rows:
    print("\t".join(r))
print(f"Total\t{tot_found}/{tot_all} ({tot_found / tot_all:.0%})")

json.dump(results, open("results_final.json", "w"), indent=1)
if EVAL_PATH:
    out = subprocess.run([sys.executable, EVAL_PATH, "results_final.json", MAP_PATH, "--ks", "5", "10", "20"],
                         capture_output=True, text=True)
    print("\n" + out.stdout, out.stderr)