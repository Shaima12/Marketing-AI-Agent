from langgraph.graph import END
from langchain_core.messages import AIMessage

from agent.config.settings import MAX_REPORT_CALLS, MAX_REPORT_REJECTIONS
from agent.graph.routing import (
    route_after_select_step,
    route_after_execute,
    route_after_replan,
    route_after_finalize,
    after_verify,
)


def ai(calls):
    return AIMessage(content="", tool_calls=calls)


def call(name):
    return [{"name": name, "args": {}, "id": "1"}]


def state(**kw):
    s = dict(messages=[], evidence={}, report=None,
             report_calls=0, report_rejections=0, next_action="")
    s.update(kw)
    return s


# ---- route_after_select_step ----
def test_select_execute():   assert route_after_select_step(state(next_action="execute")) == "execute"
def test_select_finalize():  assert route_after_select_step(state(next_action="finalize")) == "decide"
def test_select_replan():    assert route_after_select_step(state(next_action="replan")) == "replan"
def test_select_unknown():   assert route_after_select_step(state(next_action="???")) == "abort"


# ---- route_after_execute ----
def test_exec_continue():    assert route_after_execute(state(next_action="continue_current_step")) == "execute"
def test_exec_next_step():   assert route_after_execute(state(next_action="select_step")) == "select_step"
def test_exec_replan():      assert route_after_execute(state(next_action="replan")) == "replan"
def test_exec_replan_or_abort(): assert route_after_execute(state(next_action="replan_or_abort")) == "replan"
def test_exec_finalize():    assert route_after_execute(state(next_action="finalize")) == "decide"
def test_exec_abort_with_evidence_reports():
    assert route_after_execute(state(next_action="abort", evidence={"ev_1": {}})) == "decide"
def test_exec_abort_without_evidence():
    assert route_after_execute(state(next_action="abort")) == "abort"
def test_exec_unknown():     assert route_after_execute(state(next_action="???")) == "abort"


# ---- route_after_replan ----
def test_replan_select():    assert route_after_replan(state(next_action="select_step")) == "select_step"
def test_replan_finalize():  assert route_after_replan(state(next_action="finalize")) == "decide"
def test_replan_other():     assert route_after_replan(state(next_action="abort")) == "abort"


# ---- route_after_finalize (after decide) ----
def test_decide_salvage():   assert route_after_finalize(state(next_action="salvage")) == "salvage"
def test_decide_abort():     assert route_after_finalize(state(next_action="abort")) == "abort"
def test_decide_submit_goes_to_verify():
    assert route_after_finalize(state(messages=[ai(call("submit_report"))], next_action="finalize")) == "verify"
def test_decide_other_tool_goes_to_salvage():
    assert route_after_finalize(state(messages=[ai(call("run_sql"))], next_action="finalize")) == "salvage"
def test_decide_no_messages_goes_to_salvage():
    assert route_after_finalize(state(next_action="finalize")) == "salvage"


# ---- after_verify ----
def test_verify_accepted_ends():
    assert after_verify(state(report={"summary": "ok"})) == END
def test_verify_retry_under_limits():
    assert after_verify(state(report_calls=1, report_rejections=1)) == "decide"
def test_verify_rejection_cap_salvages():
    assert after_verify(state(report_calls=1, report_rejections=MAX_REPORT_REJECTIONS)) == "salvage"
def test_verify_call_cap_salvages():
    assert after_verify(state(report_calls=MAX_REPORT_CALLS, report_rejections=1)) == "salvage"