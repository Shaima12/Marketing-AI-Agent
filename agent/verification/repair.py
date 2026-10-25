import re

from agent.verification.evidence import evidence_numbers, claim_numbers, supported

_SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z(])")


def number_pools(evidence: dict) -> dict[str, list]:
    """Same extraction as check_report: result only, never the SQL text."""
    return {eid: list(evidence_numbers(rec.get("result"))) for eid, rec in evidence.items()}


def _unsupported(text: str, nums: list) -> list:
    return [(v, p) for v, p in claim_numbers(text) if not supported(v, p, nums)]


def action_ok(a: str, nums: list, banned) -> bool:
    return not _unsupported(a, nums) and not any(b.lower() in a.lower() for b in banned)


def fix_citations(finding: dict, pools: dict, log: list[str]) -> dict:
    """Drop ids that don't exist; add the id that actually holds a missing number."""
    cited = {e for e in (finding.get("evidence_ids") or []) if e in pools}
    nums = [n for e in cited for n in pools[e]]
    for v, p in _unsupported(finding.get("claim", ""), nums):
        owner = next((e for e in pools if e not in cited and supported(v, p, pools[e])), None)
        if owner:
            cited.add(owner)
            nums += pools[owner]
            log.append(f"added {owner} to a finding (number {v:.10g})")
    return {**finding, "evidence_ids": sorted(cited)}


def keep_sentences(text: str, nums: list, banned, label: str, log: list[str]) -> str:
    kept = []
    for sent in _SENT.split((text or "").strip()):
        if not sent:
            continue
        hit = any(b.lower() in sent.lower() for b in banned)
        if _unsupported(sent, nums) or hit:
            log.append(f"dropped {label} sentence: {sent[:90]}")
        else:
            kept.append(sent)
    return " ".join(kept)


def repair_report(args: dict, evidence: dict, banned, knowledge: dict, max_kb: int = 4):
    """Return (repaired_args, log), or (None, log) if no finding survives."""
    log: list[str] = []
    pools = number_pools(evidence)
    all_nums = [n for p in pools.values() for n in p]

    findings = []
    for i, f in enumerate(args.get("findings") or []):
        f = fix_citations(f, pools, log)
        nums = [n for e in f["evidence_ids"] for n in pools[e]]
        if f["evidence_ids"] and not _unsupported(f.get("claim", ""), nums):
            findings.append(f)
        else:
            log.append(f"dropped finding {i}: {str(f.get('claim', ''))[:90]}")
    if not findings:
        return None, log

    summary = keep_sentences(args.get("summary", ""), all_nums, banned, "summary", log)
    if not summary:
        summary = f"{len(findings)} findings verified. See findings."

    actions = []
    for a in args.get("actions") or []:
        if action_ok(a, all_nums, banned):
            actions.append(a)
        else:
            log.append(f"dropped action: {a[:90]}")

    return {
        "summary": summary,
        "findings": findings,
        "actions": actions,
        "knowledge_citations": [
            c for c in (args.get("knowledge_citations") or []) if c in knowledge
        ][:max_kb],
        "cannot_determine": list(args.get("cannot_determine") or []),
    }, log