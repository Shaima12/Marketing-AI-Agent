#!/usr/bin/env python3
"""
Scores a retriever against book_retrieval_map_v2.json.

Usage:
  python eval_retrieval.py results.json book_retrieval_map_v2.json [--ks 5 10] [--min-recall 0.6 --min-hit 0.9]

results.json = {"Q01": [chunk, chunk, ...], "Q02": [...], ...}   (chunks in RANK ORDER, best first)
Each chunk can be any of:
  {"heading_path": ["Part ...", "Chapter 12: ...", "Normalizing Time Periods"]}
  {"path": "Chapter 12: ... > Normalizing Time Periods"}
  {"chapter": "Chapter 12: ...", "section": "Normalizing Time Periods"}
Matching uses the LAST TWO elements (chapter, section). Several chunks from one section count once,
at the rank of the first one.

Metrics (per question, for each k):
  primary_recall@k   share of the question's primary sections found in the top k
  hit@k              1 if at least one primary section is in the top k
  precision@k        share of the top k sections that are primary or supporting
  leakage@k          share of the top k sections that are hard negatives or irrelevant
  MRR                1 / rank of the first primary section (0 if none)
"""
import argparse
import json
import re
import sys


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[`*_#]", "", s or "")).strip().lower()


def key_of(chunk):
    if "heading_path" in chunk and chunk["heading_path"]:
        p = [norm(x) for x in chunk["heading_path"]]
        return (p[-2], p[-1]) if len(p) >= 2 else (None, p[-1])
    if "path" in chunk and chunk["path"]:
        p = [norm(x) for x in chunk["path"].split(">")]
        return (p[-2], p[-1]) if len(p) >= 2 else (None, p[-1])
    if "section" in chunk:
        return (norm(chunk.get("chapter")), norm(chunk["section"]))
    return (None, None)


def split_key(s):
    a, b = [norm(x) for x in s.split(" > ", 1)]
    return (a, b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("results")
    ap.add_argument("map")
    ap.add_argument("--ks", type=int, nargs="+", default=[5, 10])
    ap.add_argument("--min-recall", type=float, default=None, help="fail if mean primary recall@max(k) is below this")
    ap.add_argument("--min-hit", type=float, default=None, help="fail if mean hit@max(k) is below this")
    a = ap.parse_args()

    res = json.load(open(a.results))
    mp = json.load(open(a.map))
    irrelevant = {split_key(s) for s in mp["irrelevant_sections"]}
    rows, totals = [], {}
    for q, spec in mp["questions"].items():
        P = {split_key(s) for s in spec["primary_sections"]}
        S = {split_key(s) for s in spec["supporting_sections"]}
        H = {split_key(s) for s in spec["hard_negative_sections"]}
        seen, ranked = set(), []
        for ch in res.get(q, []):
            k = key_of(ch)
            if k in seen or k == (None, None):
                continue
            seen.add(k)
            ranked.append(k)
        first = next((i + 1 for i, k in enumerate(ranked) if k in P), None)
        row = {"q": q, "MRR": (1 / first) if first else 0.0, "n_sections_returned": len(ranked)}
        for k in a.ks:
            top = ranked[:k]
            row[f"recall@{k}"] = len([x for x in top if x in P]) / len(P)
            row[f"hit@{k}"] = 1.0 if any(x in P for x in top) else 0.0
            row[f"precision@{k}"] = (len([x for x in top if x in P or x in S]) / len(top)) if top else 0.0
            row[f"leakage@{k}"] = (len([x for x in top if x in H or x in irrelevant]) / len(top)) if top else 0.0
        row["hard_negative_before_first_primary"] = (
            any(k in H for k in ranked[: (first - 1) if first else len(ranked)]))
        rows.append(row)
    cols = ["MRR"] + [f"{m}@{k}" for k in a.ks for m in ("recall", "hit", "precision", "leakage")]
    print("q    " + "  ".join(c.rjust(12) for c in cols) + "  hardneg_first")
    for r in rows:
        print(r["q"].ljust(5) + "  ".join(f"{r[c]:12.2f}" for c in cols) + f"  {str(r['hard_negative_before_first_primary']):>14}")
    mean = {c: sum(r[c] for r in rows) / len(rows) for c in cols}
    print("MEAN " + "  ".join(f"{mean[c]:12.2f}" for c in cols))
    kmax = max(a.ks)
    bad = []
    if a.min_recall is not None and mean[f"recall@{kmax}"] < a.min_recall:
        bad.append(f"mean recall@{kmax} {mean[f'recall@{kmax}']:.2f} < {a.min_recall}")
    if a.min_hit is not None and mean[f"hit@{kmax}"] < a.min_hit:
        bad.append(f"mean hit@{kmax} {mean[f'hit@{kmax}']:.2f} < {a.min_hit}")
    if bad:
        print("FAILED:", "; ".join(bad))
        sys.exit(1)


if __name__ == "__main__":
    main()
