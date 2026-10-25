from agent.verification.evidence import supported
from agent.verification.repair import repair_report, number_pools


def test_cross_metric_coincidence_rejected():
    assert not supported(57.57, True, [58.0, 56.89, 47563.5])
    assert not supported(14.94, True, [14.54, 15.8])


def test_legit_rounding_passes():
    assert supported(38.3, True, [38.35])
    assert supported(619000.0, False, [619181.9])


def test_wrong_number_rejected():
    assert not supported(625181.9, False, [619181.9])


def test_missing_result_key_does_not_crash():
    number_pools({"ev_1": {"tool": "run_sql"}})  # no "result" key


def test_repair_adds_missing_evidence_id():
    evidence = {
        "ev_1": {"result": {"rows": [{"customer_count": 502}]}},
        "ev_3": {"result": {"rows": [{"reviewers": 480, "pct": "95.62"}]}},
    }
    args = {
        "summary": "Top customers drive most revenue.",
        "findings": [{
            "claim": "Among the 502 top customers, 480 reviewed (95.62%).",
            "evidence_ids": ["ev_3"],
        }],
        "actions": [],
        "knowledge_citations": [],
        "cannot_determine": [],
    }
    fixed, log = repair_report(args, evidence, [], {})
    assert fixed["findings"][0]["evidence_ids"] == ["ev_1", "ev_3"]
    assert any("added ev_1" in line for line in log)