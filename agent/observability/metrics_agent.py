from typing import Any


def agent_metrics(state: dict[str, Any]) -> dict[str, int]:
    """Small snapshot suitable for structured logs or evaluation."""
    return {
        "llm_calls": int(state.get("llm_calls", 0)),
        "tool_calls": int(state.get("tool_calls", 0)),
        "sql_calls": int(state.get("sql_calls", 0)),
        "completed_steps": int(state.get("completed_steps", 0)),
        "rejections": int(state.get("rejections", 0)),
        "replans": int(state.get("replans", 0)),
    }
