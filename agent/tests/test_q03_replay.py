import json
from agent.schemas.report import Report
from agent.verification.verifier import check_report
from agent.verification.repair import repair_report
from agent.tests.fixtures.q03_attempt3 import EVIDENCE, ARGS, KNOWLEDGE  # ARGS = the attempt 3 submit_report args


def test_q03_attempt3_is_rejected_then_repaired():
    # 1. the original submission must fail the verifier
    original = Report(**ARGS)
    assert check_report(original, EVIDENCE, [])

    # 2. repair must remove the invented numbers
    fixed, log = repair_report(ARGS, EVIDENCE, [], KNOWLEDGE)
    dump = json.dumps(fixed)
    assert "78805.95" not in dump
    assert "14.94" not in dump
    assert "57.57" not in dump          # the one the old verifier missed

    # 3. summary and actions survive
    assert fixed["summary"]
    assert len(fixed["actions"]) == 3

    # 4. the safety guarantee: repaired output passes your own verifier
    assert not check_report(Report(**fixed), EVIDENCE, [])

    print(*log, sep="\n")