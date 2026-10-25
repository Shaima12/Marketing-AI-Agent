import json

from langchain_core.messages import SystemMessage, HumanMessage

from agent.schemas.investigation_plan import InvestigationPlan
from agent.llm.prompts import guide_block
from agent.graph.execution_control import (
    validate_plan_catalog,
    clamp_execution_limits,
)
from agent.config.settings import (
    MAX_PLAN_STEPS,
    DEFAULT_MAX_TOOL_CALLS,
    DEFAULT_MAX_SQL_CALLS,
    DEFAULT_MAX_REPLANS,
    DEFAULT_MAX_LLM_CALLS,
    MAX_TOTAL_TOKENS,
)


def _dump(value) -> str:
    return json.dumps(value, default=str, ensure_ascii=False)


def _evidence_index(evidence: dict, max_input_chars: int = 300) -> dict:
    """What was already queried, without the (large) results."""
    index = {}
    for eid, rec in evidence.items():
        text = _dump(rec.get("input"))
        index[eid] = {
            "tool": rec.get("tool"),
            "step_id": rec.get("step_id"),
            "input": (
                text
                if len(text) <= max_input_chars
                else text[:max_input_chars] + "..."
            ),
        }
    return index


def make_replan_node(llm, system, tool_catalog: str):
    replanner = llm.with_structured_output(InvestigationPlan)

    def replan(state):
        plan = state.get("plan") or {}
        limits = plan.get("execution_limits") or {}

        used = int(state.get("replans", 0))
        max_replans = int(limits.get("max_replans", DEFAULT_MAX_REPLANS))
        current_llm_calls = int(state.get("llm_calls", 0))
        max_llm_calls = int(limits.get("max_llm_calls", DEFAULT_MAX_LLM_CALLS))

        # Budget gates: stop planning and report with what we have.
        if used >= max_replans:
            return {
                "ready": True,
                "investigation_complete": False,
                "stop_reason": "replan_budget_exhausted",
                "next_action": "finalize",
                "last_error": (
                    f"Replan budget exhausted ({used}/{max_replans}). "
                    "Finalize with the evidence already collected and "
                    "disclose the limitation."
                ),
            }

        if (
            current_llm_calls >= max_llm_calls
            or int(state.get("tokens_used", 0)) >= MAX_TOTAL_TOKENS
        ):
            return {
                "ready": True,
                "investigation_complete": False,
                "stop_reason": "llm_budget_exhausted",
                "next_action": "finalize",
                "last_error": (
                    "Replanning skipped: investigation budget exhausted. "
                    "Finalize with the evidence already collected."
                ),
            }

        evidence_index = _evidence_index(state.get("evidence") or {})

        result = replanner.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"""
Original user question:
{state.get("user_request")}

Current plan:
{_dump(plan)}

Step results (status, evidence ids, short summaries):
{_dump(state.get("step_results") or {})}

Evidence index (queries already run; results are not repeated here):
{_dump(evidence_index)}

Failure / blocking reason:
{state.get("last_error")}

{guide_block(state.get("knowledge"))}

Registered tool catalog:
{tool_catalog}

Rules:
- Revise only when a material evidence gap, contradiction, or blocked dependency justifies it.
- Keep completed work: a completed step must keep its exact id, objective and output_key, otherwise its result is discarded and the work is redone.
- Do not duplicate completed objectives or repeat identical failed calls.
- Do not create a synthesis, summary or reporting step. The report is written automatically after the investigation.
- Every step must use at least one registered tool.
- Use only registered tool names and retrieved KB IDs.
- Respect remaining execution budgets; do not reset counters.
""")
        ])

        plan_data = clamp_execution_limits(
            result.model_dump(mode="json"),
            max_steps=MAX_PLAN_STEPS,
            max_tool_calls=DEFAULT_MAX_TOOL_CALLS,
            max_sql_calls=DEFAULT_MAX_SQL_CALLS,
            max_replans=DEFAULT_MAX_REPLANS,
            max_llm_calls=DEFAULT_MAX_LLM_CALLS,
        )

        registered_names = {
            line.split(":", 1)[0].strip().lstrip("-").strip()
            for line in tool_catalog.splitlines()
            if line.strip().startswith("-") and ":" in line
        }

        validate_plan_catalog(
            plan_data,
            registered_names,
            set((state.get("knowledge") or {}).keys()),
        )

        # Keep finished results when the step contract is unchanged;
        # everything else restarts as pending (evidence stays in state).
        old_results = dict(state.get("step_results") or {})
        old_steps = {
            item.get("id"): item
            for item in plan.get("steps", [])
            if isinstance(item, dict)
        }

        new_results = {}
        for step in plan_data["steps"]:
            step_id = step["id"]
            previous = old_results.get(step_id)
            old_step = old_steps.get(step_id, {})

            same_contract = (
                old_step.get("output_key") == step["output_key"]
                and old_step.get("objective") == step["objective"]
            )

            if (
                previous
                and previous.get("status") in {"completed", "skipped"}
                and same_contract
            ):
                new_results[step_id] = previous
            else:
                new_results[step_id] = {
                    "status": "pending",
                    "output_key": step["output_key"],
                    "data": None,
                    "evidence_ids": [],
                }

        return {
            "plan": plan_data,
            "llm_calls": current_llm_calls + 1,
            "step_results": new_results,
            "replans": used + 1,
            "current_step_id": None,
            "ready": False,
            "investigation_complete": False,
            "stop_reason": None,
            "next_action": "select_step",
            "last_error": None,
        }

    return replan