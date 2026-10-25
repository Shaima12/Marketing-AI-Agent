from __future__ import annotations

import hashlib
import json
from typing import Any

from agent.config.settings import (
    DEFAULT_MAX_SQL_CALLS,
    DEFAULT_MAX_TOOL_CALLS,
    SQL_TOOL_NAMES,
)


class ExecutionBudgetExceeded(RuntimeError):
    pass


class DuplicateToolCall(RuntimeError):
    pass


def fingerprint_tool_call(tool_name: str, args: dict[str, Any]) -> str:
    """Stable fingerprint for exact-argument deduplication."""
    canonical = json.dumps(
        args, sort_keys=True, separators=(",", ":"), default=str
    )
    raw = f"{tool_name}:{canonical}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def is_sql_tool(tool_name: str) -> bool:
    return tool_name in SQL_TOOL_NAMES


def check_budgets(state: dict[str, Any], tool_name: str) -> None:
    plan = state.get("plan") or {}
    limits = plan.get("execution_limits") or {}

    max_tools = int(limits.get("max_tool_calls", DEFAULT_MAX_TOOL_CALLS))
    max_sql = int(limits.get("max_sql_calls", DEFAULT_MAX_SQL_CALLS))

    if int(state.get("tool_calls", 0)) >= max_tools:
        raise ExecutionBudgetExceeded(
            f"Tool-call budget reached ({max_tools})."
        )

    if is_sql_tool(tool_name) and int(state.get("sql_calls", 0)) >= max_sql:
        raise ExecutionBudgetExceeded(
            f"SQL-call budget reached ({max_sql})."
        )


def validate_tool_allowed_for_step(
    tool_name: str,
    step: dict[str, Any] | None,
    allowed_tool_names: set[str],
) -> None:
    if tool_name not in allowed_tool_names:
        raise PermissionError(f"Tool is not registered: {tool_name}")

    if step is None:
        raise PermissionError("No active analytical step.")

    candidates = set(step.get("tool_candidates") or [])
    # An empty candidate list must not mean unrestricted access.
    if not candidates:
        raise PermissionError(
            f"Step {step.get('id')} has no allowed tool_candidates."
        )
    if tool_name not in candidates:
        raise PermissionError(
            f"Tool {tool_name} is not allowed for step {step.get('id')}."
        )


def get_step(plan: dict[str, Any], step_id: str | None) -> dict[str, Any] | None:
    if not step_id:
        return None
    for step in plan.get("steps", []):
        if step.get("id") == step_id:
            return step
    return None


def resolve_dependencies(
    step: dict[str, Any],
    step_results: dict[str, Any],
) -> dict[str, Any]:
    resolved: dict[str, Any] = {}
    for dep in step.get("depends_on", []):
        result = step_results.get(dep["step_id"])
        if not result or result.get("status") != "completed":
            if dep.get("optional", False):
                continue
            raise ValueError(
                f"Dependency {dep['step_id']} is not completed."
            )
        if result.get("output_key") != dep["output_key"]:
            raise ValueError(
                f"Stored output key mismatch for {dep['step_id']}."
            )
        resolved[dep["output_key"]] = result.get("data")
    return resolved


def select_next_step(plan: dict[str, Any], step_results: dict[str, Any]):
    """Return the first ready step, or None when no pending step is ready."""
    for step in plan.get("steps", []):
        if step.get("status") not in {"pending", "blocked"}:
            continue

        ready = True
        for dep in step.get("depends_on", []):
            dep_result = step_results.get(dep["step_id"])
            if dep_result and dep_result.get("status") == "completed":
                continue
            if dep.get("optional", False):
                continue
            ready = False
            break

        if ready:
            return step
    return None


def required_steps_complete(plan: dict[str, Any], step_results: dict[str, Any]) -> bool:
    for step in plan.get("steps", []):
        if step.get("optional", False):
            continue
        result = step_results.get(step["id"], {})
        if result.get("status") not in {"completed", "skipped"}:
            return False
        if result.get("status") == "skipped" and not step.get("skip_if_data_unavailable"):
            return False
    return True


def validate_plan_catalog(
    plan: dict[str, Any],
    registered_tool_names: set[str],
    available_knowledge_ids: set[str],
) -> None:
    """Reject references the runtime cannot honor.

    Raises ValueError for unusable steps. Unknown handbook IDs are advisory
    hints, so they are dropped instead of failing the whole plan.
    """
    for step in plan.get("steps", []):
        candidates = set(step.get("tool_candidates") or [])

        if not candidates:
            raise ValueError(
                f"{step['id']} has no tool_candidates. Every step must use "
                "at least one registered tool. Do not plan synthesis, "
                "summary, or reporting steps."
            )

        if "submit_report" in candidates:
            raise ValueError(
                f"{step['id']} uses submit_report. Reporting is automatic "
                "after the investigation; do not plan a reporting step."
            )

        unknown_tools = candidates - registered_tool_names
        if unknown_tools:
            raise ValueError(
                f"{step['id']} references unregistered tools: "
                f"{sorted(unknown_tools)}"
            )

        step["guide_ids"] = [
            kid
            for kid in (step.get("guide_ids") or [])
            if kid in available_knowledge_ids
        ]


def clamp_execution_limits(
    plan: dict[str, Any],
    *,
    max_steps: int,
    max_tool_calls: int,
    max_sql_calls: int,
    max_replans: int,
    max_llm_calls: int,
) -> dict[str, Any]:
    """Enforce application-defined execution limits."""

    result = dict(plan)
    limits = dict(result.get("execution_limits") or {})

    # The application defines the hard limits.
    # Do not let the planner accidentally choose a smaller LLM budget.
    limits["max_plan_steps"] = max_steps
    limits["max_tool_calls"] = max_tool_calls
    limits["max_sql_calls"] = max_sql_calls
    limits["max_replans"] = max_replans
    limits["max_llm_calls"] = max_llm_calls

    result["execution_limits"] = limits

    if len(result.get("steps", [])) > max_steps:
        raise ValueError("Plan exceeds the application step limit.")

    return result