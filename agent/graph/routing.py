from langgraph.graph import END

from agent.config.settings import MAX_REPORT_CALLS, MAX_REPORT_REJECTIONS


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
        # Evidence already collected is worth a report attempt.
        # With no evidence there is nothing to report.
        return "decide" if state.get("evidence") else "abort"

    # Unknown actions should fail safely and visibly.
    return "abort"


def route_after_replan(state):
    action = state.get("next_action")

    if action == "select_step":
        return "select_step"
    if action == "finalize":
        return "decide"

    return "abort"


def route_after_finalize(state):
    """After `decide`: verify a submitted report, or recover via salvage."""
    action = state.get("next_action")

    if action == "salvage":
        return "salvage"
    if action == "abort":
        return "abort"

    # Inspect the latest AI message, not an older message.
    for message in reversed(state.get("messages") or []):
        if getattr(message, "type", "") != "ai":
            continue

        tool_calls = getattr(message, "tool_calls", []) or []
        if any(call.get("name") == "submit_report" for call in tool_calls):
            return "verify"

        return "salvage"

    return "salvage"


def after_verify(state):
    """Accepted report -> END. Otherwise retry, or salvage when spent."""
    if state.get("report"):
        return END

    if (
        int(state.get("report_rejections", 0)) >= MAX_REPORT_REJECTIONS
        or int(state.get("report_calls", 0)) >= MAX_REPORT_CALLS
    ):
        return "salvage"

    # Reuse `decide` to submit a corrected report.
    return "decide"