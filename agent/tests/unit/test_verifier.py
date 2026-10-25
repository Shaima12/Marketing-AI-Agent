from agent.schemas.report import Report, Finding
from agent.verification.verifier import check_report

EVIDENCE = {
    "ev_1": {"result": {"rows": [{"discount_pct": "25.00"}]}},
    "ev_2": {"result": {"rows": [{"daily_net_revenue": "9688.41", "aov": "85.97"}]}},
}


def report(summary="ok", claim="ok", ids=("ev_2",)):
    return Report(summary=summary, findings=[Finding(claim=claim, evidence_ids=list(ids))])


def test_supported_number_passes():
    r = report(claim="Revenue reached $9,688.41 per day")
    assert check_report(r, EVIDENCE, []) == []


def test_number_in_other_evidence_gets_a_hint():
    r = report(claim="The discount was 25% off")          # cites ev_2, but 25 lives in ev_1
    problems = check_report(r, EVIDENCE, [])
    assert len(problems) == 1
    assert "ev_1" in problems[0] and "add it" in problems[0]


def test_invented_number_is_rejected():
    r = report(claim="Revenue grew 47984.10 overall")
    problems = check_report(r, EVIDENCE, [])
    assert len(problems) == 1 and "no evidence" in problems[0]


def test_missing_evidence_id():
    r = report(ids=("ev_9",))
    assert "does not exist" in check_report(r, EVIDENCE, [])[0]


def test_summary_invented_number_is_rejected():
    r = report(summary="Total gain was $15,898.10")
    problems = check_report(r, EVIDENCE, [])
    assert len(problems) == 1 and "summary" in problems[0]


def test_summary_may_use_any_evidence():
    r = report(summary="Daily revenue was $9,688.41 with a 25% discount")
    assert check_report(r, EVIDENCE, []) == []


def test_banned_claim():
    r = report(summary="guaranteed results")
    assert any("banned" in p for p in check_report(r, EVIDENCE, ["guaranteed"]))