from agent.schemas.report import Report
from agent.verification.evidence import evidence_numbers, claim_numbers, supported


def check_report(report: Report, evidence: dict, banned: list[str]) -> list[str]:
    problems = []

    # Extract each evidence record's numbers once.
    cache: dict[str, list] = {}

    def nums_of(eid: str) -> list:
        if eid not in cache:
            cache[eid] = list(evidence_numbers(evidence[eid]["result"]))
        return cache[eid]

    for f in report.findings:
        missing = [e for e in f.evidence_ids if e not in evidence]
        problems += [f"evidence {e} does not exist" for e in missing]
        if missing:
            continue

        nums = [n for e in f.evidence_ids for n in nums_of(e)]
        for value, is_pct in claim_numbers(f.claim):
            if supported(value, is_pct, nums):
                continue

            # Tell the model where the number actually lives.
            elsewhere = [
                e for e in evidence
                if e not in f.evidence_ids and supported(value, is_pct, nums_of(e))
            ]
            if elsewhere:
                hint = f"it is present in {', '.join(elsewhere)}: add it to evidence_ids"
            else:
                hint = ("it is in no evidence: remove it or state the point "
                        "qualitatively; never compute it yourself")
            problems.append(
                f"number {value:.10g} in claim '{f.claim[:60]}...' "
                f"is not in the cited evidence; {hint}"
            )

    # The summary is the headline readers trust most, so check it too.
    # Tolerant on purpose: a number may come from ANY evidence record.
    all_nums = [n for e in evidence for n in nums_of(e)]
    for value, is_pct in claim_numbers(report.summary):
        if not supported(value, is_pct, all_nums):
            problems.append(
                f"number {value:.10g} in the summary is in no evidence: "
                "remove it or state the point qualitatively; never compute it yourself"
            )

    text = report.model_dump_json().lower()
    for a in report.actions:
        for value, is_pct in claim_numbers(a):
            if not supported(value, is_pct, all_nums):
                problems.append(
                    f"number {value:.10g} in an action is in no evidence: "
                    "remove it or state the point qualitatively"
                )
    problems += [f"banned claim used: {b}" for b in banned if b.lower() in text]
    return problems[:8]