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


def make_plan_node(llm, system, tool_catalog: str):
    """
    Use a structured-output-capable model. If your provider does not support
    native structured output, adapt agent/llm/structured.py to use JSON mode
    and validate with InvestigationPlan.model_validate().
    """
    planner = llm.with_structured_output(InvestigationPlan)

    def plan(state):
        question = state.get("user_request")
        if not question:
            raise ValueError("state['user_request'] must be initialized at request entry.")

        llm_calls = int(state.get("llm_calls", 0))
        if llm_calls >= DEFAULT_MAX_LLM_CALLS:
            raise RuntimeError("Global LLM-call budget reached before planning.")

        result = planner.invoke([
            SystemMessage(content=system),
            HumanMessage(content=f"""
Question:
{question}

{guide_block(state.get("knowledge"))}

Registered tool catalog:
{tool_catalog}

Create a concise executable investigation plan.

Rules:
- Create 1 to 7 analytical steps, not one step per metric or SQL statement.
- Each step must have a unique id and output_key.
- Each dependency must refer to an earlier analytical result by step_id and output_key.
- Use only tool names from the supplied catalog in tool_candidates.
- A step may list multiple compatible tool candidates, but only list tools it genuinely needs.
- Group compatible metrics and time windows into one analytical objective.
- Include success criteria that answer the user's actual question.
- Do not invent years, sale dates, table names, columns, or metric definitions.
- If essential information is missing, add a clarification/coverage step rather than guessing.
- Handbook IDs must be IDs actually present in the GUIDE.
- Methodology is not business evidence.
- Set sensible budgets within the configured defaults.
- Keep optional investigations optional.
""")
        ])

        # Application limits override anything the model proposes.
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
        return {
            "plan": plan_data,
            "llm_calls": llm_calls + 1,
            "current_step_id": None,
            "step_results": {},
            "tool_cache": state.get("tool_cache", {}),
            "seen_tool_fingerprints": state.get("seen_tool_fingerprints", []),
            "next_action": "select_step",
            "last_error": None,
        }

    return plan
