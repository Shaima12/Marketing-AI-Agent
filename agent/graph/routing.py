
from langgraph.graph import END

from agent.config.settings import MAX_REJECTIONS, MAX_STEPS


def _tool_calls(state):
    """Return tool calls from the latest AI message, if any."""
    messages = state.get("messages") or []
    if not messages:
        return []

    last_message = messages[-1]
    return getattr(last_message, "tool_calls", None) or []


def route_after_select_step(state):
    """Route the scheduler's decision."""
    action = state.get("next_action")

    if action == "execute":
        return "execute"
    if action == "finalize":
        return "decide"
    if action == "replan":
        return "replan"

    return "abort"




def route_after_execute(state):
    """Route executor outcomes explicitly."""
    action = state.get("next_action")

    if action == "continue_current_step":
        return "execute"

    if action == "select_step":
        return "select_step"

    if action == "replan":
        return "replan"

    if action == "replan_or_abort":
        # Let the replan node enforce the configured replan budget.
        return "replan"

    if action == "finalize":
        return "decide"

    if action == "abort":
        return "abort"

    # Unknown actions should fail safely and visibly.
    return "abort"


def route_after_replan(state):
    if state.get("next_action") == "select_step":
        return "select_step"

    return "abort"


def route_after_finalize(state):
    """
    The existing decide node is retained for final report submission.
    It must call submit_report; other tool calls are not accepted here.
    """
    calls = _tool_calls(state)

    if any(call.get("name") == "submit_report" for call in calls):
        return "verify"

    return "abort"


def after_verify(state):
    """Keep the existing verify -> accept, abort, or revise-report behavior."""
    if state.get("report"):
        return END

    if (
        state.get("rejections", 0) >= MAX_REJECTIONS
        or state.get("steps", 0) >= MAX_STEPS
    ):
        return "abort"

    # Reuse the existing decide node to submit a corrected report.
    return "decide"
