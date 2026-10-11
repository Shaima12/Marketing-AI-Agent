from agent.schemas.report import Report
from agent.verification.evidence import evidence_numbers, claim_numbers, supported

def check_report(report: Report, evidence: dict, banned: list[str]) -> list[str]:
    problems = []
    for f in report.findings:
        missing = [e for e in f.evidence_ids if e not in evidence]
        problems += [f"evidence {e} does not exist" for e in missing]
        if missing:
            continue
        nums = [n for e in f.evidence_ids for n in evidence_numbers(evidence[e]["result"])]
        for value, is_pct in claim_numbers(f.claim):
            if not supported(value, is_pct, nums):
                problems.append(f"number {value:g} in '{f.claim[:60]}...' not found in cited evidence")
    text = report.model_dump_json().lower()
    problems += [f"banned claim used: {b}" for b in banned if b.lower() in text]
    return problems[:8]