from langchain_core.messages import SystemMessage, HumanMessage
from agent.schemas.investigation_plan import InvestigationPlan
from agent.llm.prompts import guide_block
from agent.graph.execution_control import validate_plan_catalog, clamp_execution_limits
from agent.config.settings import (
    MAX_PLAN_STEPS,
    DEFAULT_MAX_TOOL_CALLS,
    DEFAULT_MAX_SQL_CALLS,
    DEFAULT_MAX_REPLANS,
    DEFAULT_MAX_LLM_CALLS,
)


def make_replan_node(llm, system, tool_catalog: str):
    replanner = llm.with_structured_output(InvestigationPlan)

    def replan(state):
        plan = state.get("plan") or {}
        limits = plan.get("execution_limits") or {}
        used = int(state.get("replans", 0))
        max_replans = int(limits.get("max_replans", 1))
        if used >= max_replans:
            return {
                "next_action": "abort",
                "last_error": "Replanning budget reached.",
            }

        # Keep completed outputs; new plans must not silently discard evidence.
        llm_calls = int(state.get("llm_calls", 0))
        if llm_calls >= DEFAULT_MAX_LLM_CALLS:
            return {
                "next_action": "abort",
                "last_error": "Global LLM-call budget reached.",
            }

        result = replanner.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"""
Original user question:
{state.get("user_request")}

Current plan:
{plan}

Step results:
{state.get("step_results", {})}

Evidence index:
{{
  key: {{"tool": val.get("tool"), "input": val.get("input")}}
  for key, val in (state.get("evidence") or {{}}).items()
}}

Failure / blocking reason:
{state.get("last_error")}

{guide_block(state.get("knowledge"))}

Registered tool catalog:
{tool_catalog}

Revise only when a material evidence gap, contradiction, or blocked dependency justifies it.
Keep completed work when still valid. Do not duplicate completed objectives or repeat identical failed calls.
Use only registered tool names and retrieved KB IDs.
Respect remaining execution budgets; do not reset counters.
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

        # Keep counters and evidence, but initialize result records for the revised plan.
        old_results = dict(state.get("step_results") or {})
        new_results = {}
        old_steps = {
            item.get("id"): item
            for item in plan.get("steps", [])
            if isinstance(item, dict)
        }
        for step in plan_data["steps"]:
            step_id = step["id"]
            previous = old_results.get(step_id)
            old_step = old_steps.get(step_id, {})
            same_contract = (
                old_step.get("output_key") == step["output_key"]
                and old_step.get("objective") == step["objective"]
            )
            if previous and previous.get("status") == "completed" and same_contract:
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
            "llm_calls": llm_calls + 1,
            "step_results": new_results,
            "replans": used + 1,
            "current_step_id": None,
            "ready": False,
            "next_action": "select_step",
            "last_error": None,
        }

    return replan
