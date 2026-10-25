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
)

# InvestigationPlan.steps has max_length=6; never ask the model for more
# than the schema accepts.
PLAN_STEP_LIMIT = min(MAX_PLAN_STEPS, 6)


def _step_signature(step):
    """Compare step definitions while ignoring runtime status."""
    return {
        key: value
        for key, value in step.items()
        if key != "status"
    }


def make_plan_node(llm, system, tool_catalog: str):
    planner = llm.with_structured_output(InvestigationPlan)

    def plan(state):
        question = state.get("user_request")
        if not question:
            raise ValueError(
                "state['user_request'] must be initialized at request entry."
            )

        llm_calls = int(state.get("llm_calls", 0))
        if llm_calls >= DEFAULT_MAX_LLM_CALLS:
            return {
                "next_action": "abort",
                "last_error": (
                    "Global LLM-call budget reached before planning."
                ),
                "investigation_complete": False,
                "stop_reason": "llm_budget_exhausted",
            }

        previous_plan = state.get("plan") or {}
        previous_results = state.get("step_results") or {}

        result = planner.invoke(
            [
                SystemMessage(content=system),
                HumanMessage(
                    content=f"""
Question:
{question}

{guide_block(state.get("knowledge"))}

Registered tool catalog:
{tool_catalog}

Create a concise executable investigation plan.

Plan size and budget:
- Create 2 to 4 analytical steps for a typical question. Hard maximum: {PLAN_STEP_LIMIT}.
- The whole investigation has a small LLM-call budget. Each step costs at least
  one model call per round of queries, so fewer, richer steps are better.
- A step is ONE analytical question answered by 1 to 3 queries. Do not create
  one step per metric, SQL statement, or tool call.
- Prefer a single SQL query (using CTEs) that computes all periods, per-day
  values, differences, percentage changes, and combined-window totals needed
  to answer the step.

Step rules:
- Each step must have a unique id and output_key.
- Each dependency must reference an earlier analytical result using
  its step_id and output_key.
- Every step must list at least one registered tool in tool_candidates.
- Do NOT create a synthesis, summary, conclusion, or reporting step. The final
  report is written automatically after the investigation ends.
- Set auto_complete_on_success=true only for a simple lookup that one
  successful query fully answers (for example reading a promotions table).
  Leave it false for analytical steps.
- Use only registered tool names from the supplied catalog.
- Use database tools for structured business data.
- Use knowledge retrieval for methodology, not business-result evidence.
- Use web search only when external/current information is needed
  and a suitable registered tool is available.
- Combine related metrics and time windows when efficient.
- Do not invent dates, table names, columns, facts, or metric definitions.
- Do not plan exploratory queries (date ranges, row counts, schema checks):
  the schema is already in the system prompt.
- Set explicit success criteria and identify the evidence needed.
- Keep optional investigations optional.
- Use only handbook IDs present in the supplied GUIDE.
- Keep execution budgets within application limits.
- Do not repeat completed investigations unless a material gap,
  contradiction, or new evidence justifies it.
- Plan evidence collection, not merely tool execution. Phrase steps as
  evidence to check, not as conclusions already reached.
- If available tools cannot establish a conclusion, record the limitation
  in the success criteria instead of adding a step for it.
"""
                ),
            ]
        )

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

        # Preserve results only when the step definition is unchanged.
        old_steps = {
            step["id"]: _step_signature(step)
            for step in previous_plan.get("steps", [])
        }

        preserved_results = {}

        for step in plan_data.get("steps", []):
            step_id = step["id"]
            old_result = previous_results.get(step_id)

            if not old_result:
                continue

            old_signature = old_steps.get(step_id)
            new_signature = _step_signature(step)

            if (
                old_signature == new_signature
                and old_result.get("status") in {"completed", "skipped"}
            ):
                preserved_results[step_id] = old_result
                step["status"] = old_result["status"]
            else:
                step["status"] = "pending"

        for step in plan_data.get("steps", []):
            step.setdefault("status", "pending")

        return {
            "plan": plan_data,
            "llm_calls": llm_calls + 1,
            "current_step_id": None,
            "step_results": preserved_results,
            "tool_cache": state.get("tool_cache", {}),
            "seen_tool_fingerprints": state.get(
                "seen_tool_fingerprints", []
            ),
            "next_action": "select_step",
            "last_error": None,
            "investigation_complete": False,
            "stop_reason": None,
        }

    return plan