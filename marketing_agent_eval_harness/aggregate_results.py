#!/usr/bin/env python3
"""Aggregate per-question judge files into analysis coverage + check pass rate.

Usage:
    python aggregate_results.py
    python aggregate_results.py --in-dir judge_results --out report_judge_eval.json
    python aggregate_results.py --questions questions.json   # warns about unjudged questions
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def natural_key(name: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute coverage and pass rate over all judged questions.")
    parser.add_argument("--in-dir", default="judge_results")
    parser.add_argument("--out", default="report_judge_eval.json")
    parser.add_argument("--questions", default=None,
                        help="Optional questions.json, used to report questions not yet judged.")
    args = parser.parse_args()

    in_dir = Path(args.in_dir)
    files = sorted(in_dir.glob("*.json"), key=lambda p: natural_key(p.stem))
    if not files:
        raise SystemExit(f"No JSON files found in {in_dir}/. Run judge_question.py first.")

    judged = [json.loads(p.read_text(encoding="utf-8")) for p in files]
    failed = sum(1 for item in judged if item.get("judge_error"))

    missing: list[str] = []
    if args.questions:
        all_ids = [q["id"] for q in json.loads(Path(args.questions).read_text(encoding="utf-8")).get("questions", [])]
        done = {item["qid"] for item in judged}
        missing = [q for q in all_ids if q not in done]

    total_checks = sum(len(item.get("checks", [])) for item in judged)
    passed_checks = sum(
        1 for item in judged for c in item.get("checks", []) if c.get("passed") is True
    )
    applicable = [
        v for item in judged for v in item.get("analysis_dimensions", {}).values()
        if v.get("applicable") is True
    ]
    covered = sum(1 for v in applicable if v.get("covered") is True)

    summary = {
        "analysis_coverage_percent": round(100 * covered / len(applicable), 2) if applicable else 0.0,
        "check_pass_rate_percent": round(100 * passed_checks / total_checks, 2) if total_checks else 0.0,
    }

    per_question = []
    for item in judged:
        checks = item.get("checks", [])
        q_total = len(checks)
        q_pass = sum(c.get("passed") is True for c in checks)
        dims = [v for v in item.get("analysis_dimensions", {}).values() if v.get("applicable") is True]
        q_cov = sum(v.get("covered") is True for v in dims)
        per_question.append(
            {
                "qid": item["qid"],
                "analysis_coverage_percent": round(100 * q_cov / len(dims), 2) if dims else 0.0,
                "check_pass_rate_percent": round(100 * q_pass / q_total, 2) if q_total else 0.0,
                "judge_error": item.get("judge_error"),
                "checks": [
                    {
                        "check": c["check"],
                        "score": 1 if c.get("passed") is True else 0,
                        "reason": c.get("reason"),
                        "report_refs": c.get("report_refs", []),
                        "evidence_refs": c.get("evidence_refs", []),
                    }
                    for c in checks
                ],
                "analysis_dimensions": {
                    d: {
                        "applicable": v.get("applicable"),
                        "score": 1 if v.get("covered") is True else 0 if v.get("applicable") else None,
                        "reason": v.get("reason"),
                    }
                    for d, v in item.get("analysis_dimensions", {}).items()
                },
                "consistency_issues": item.get("consistency_issues", []),
            }
        )

    models = sorted({str(i.get("judge_model")) for i in judged if i.get("judge_model")})
    output = {
        "evaluation_name": "Final report analysis coverage and check pass rate",
        "judge_provider": "Google Gemini",
        "judge_models": models,
        "questions_evaluated": len(judged),
        "questions_not_yet_judged": missing,
        "judge_failures": failed,
        "total_checks": total_checks,
        "summary": summary,
        "per_question": per_question,
        "scoring_definition": {
            "analysis_coverage": "Covered applicable dimensions / all applicable dimensions across all questions. Each applicable dimension is binary: covered=1, absent/unsupported=0. Not-applicable dimensions are excluded.",
            "check_pass_rate": "Passed checklist items / all checklist items. Each item is binary: pass=1; otherwise=0. Judge errors are conservatively counted as 0.",
        },
        "limitations": [
            "LLM judge results are estimates; manually review a sample before treating them as a release gate.",
            "Exact numeric/ID checks should also be recomputed deterministically from source rows.",
            "If judge_failures > 0 or questions_not_yet_judged is non-empty, the aggregate metrics are not a complete evaluation.",
        ],
    }
    Path(args.out).write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"{'QID':<6} {'Coverage':>9} {'PassRate':>9}")
    for q in per_question:
        flag = "  (judge error)" if q["judge_error"] else ""
        print(f"{q['qid']:<6} {q['analysis_coverage_percent']:>8}% {q['check_pass_rate_percent']:>8}%{flag}")
    print("\nFINAL METRICS")
    print(f"Analysis coverage: {summary['analysis_coverage_percent']}%")
    print(f"Check pass rate:  {summary['check_pass_rate_percent']}%")
    print(f"Questions judged: {len(judged)}  |  Judge failures: {failed}")
    if missing:
        print(f"WARNING: not yet judged: {', '.join(missing)}")
    if failed:
        print("WARNING: some judge calls failed; re-run those questions before trusting the totals.")
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
