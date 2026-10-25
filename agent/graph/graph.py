from langgraph.graph import StateGraph, START, END
from langgraph.types import RetryPolicy

from agent.llm.models import get_llm
from agent.llm.prompts import build_system_prompt
from agent.tools.registry import make_tools
from agent.graph.state import AgentState
from agent.graph.routing import (
    route_after_select_step,
    route_after_execute,
    route_after_replan,
    route_after_finalize,
    after_verify,
)
from agent.graph.nodes.plan import make_plan_node
from agent.graph.nodes.decide import make_decide_node
from agent.graph.nodes.execute import make_execute_node
from agent.graph.nodes.replan import make_replan_node
from agent.graph.nodes.select_step import make_select_step_node
from agent.graph.nodes.verify import make_verify_node
from agent.graph.nodes.abort import abort
from agent.graph.nodes.salvage import make_salvage_node
from agent.graph.nodes.guide import make_guide_node
from agent.observability.tracing import traced
from agent.retrieval.retrieval import search_handbook


# LangGraph's default retry skips ValueError, but our plan validation raises
# ValueError for bad model output, which is worth retrying. Only obvious
# programming bugs are excluded.
_PROGRAMMING_ERRORS = (TypeError, AttributeError, KeyError, NameError, ImportError)


def _retry_planning(exc: Exception) -> bool:
    return not isinstance(exc, _PROGRAMMING_ERRORS)


PLANNER_RETRY = RetryPolicy(max_attempts=3, retry_on=_retry_planning)


def build_graph(ctx,user_question: str):
    system, banned = build_system_prompt(
        brand_id=ctx.brand_id,
        user_question=user_question,
    )
    tools = make_tools(ctx)

    # submit_report must exist, but ONLY the report model may use it.
    report_tool = next(
        (t for t in tools if getattr(t, "name", None) == "submit_report"),
        None,
    )
    if report_tool is None:
        raise ValueError("The tool catalog must include submit_report.")

    # Investigation tools: everything except submit_report. The planner and
    # the executor never see it, so no "synthesis" step can be planned.
    investigation_tools = [
        t for t in tools if getattr(t, "name", None) != "submit_report"
    ]

    llm = get_llm(thinking_level="low")
    llm_with_tools = llm.bind_tools(investigation_tools)

    tool_catalog = "\n".join(
        f"- {tool.name}: {getattr(tool, 'description', '')}; "
        f"args={getattr(tool, 'args_schema', None)}"
        for tool in investigation_tools
    )

    # Separate report model: lower reasoning overhead, only one tool.
    llm_for_report = get_llm(thinking_level="low").bind_tools(
        [report_tool],
        tool_choice="submit_report",
    )

    g = StateGraph(AgentState)

    g.add_node("guide", make_guide_node(search_handbook))

    g.add_node(
        "plan",
        make_plan_node(llm, system, tool_catalog),
        retry_policy=PLANNER_RETRY,
    )

    g.add_node("select_step", make_select_step_node())

    g.add_node(
        "execute",
        make_execute_node(investigation_tools, llm_with_tools, system),
    )

    g.add_node(
        "replan",
        make_replan_node(llm, system, tool_catalog),
        retry_policy=PLANNER_RETRY,
    )

    # No retry_policy: decide handles its own failures and reports through
    # next_action. A framework retry would bypass the report_calls budget.
    g.add_node("decide", make_decide_node(llm_for_report, system))

    g.add_node("verify", make_verify_node(banned))
    g.add_node("salvage", make_salvage_node(banned))
    g.add_node("abort", abort)

    g.add_edge(START, "guide")
    g.add_edge("guide", "plan")
    g.add_edge("plan", "select_step")

    g.add_conditional_edges(
        "select_step",
        traced(route_after_select_step),
        {
            "execute": "execute",
            "decide": "decide",
            "replan": "replan",
            "abort": "abort",
        },
    )

    g.add_conditional_edges(
        "execute",
        traced(route_after_execute),
        {
            "execute": "execute",
            "select_step": "select_step",
            "replan": "replan",
            "decide": "decide",
            "abort": "abort",
        },
    )

    g.add_conditional_edges(
        "replan",
        traced(route_after_replan),
        {
            "select_step": "select_step",
            "abort": "abort",
            "decide": "decide",
        },
    )

    g.add_conditional_edges(
        "decide",
        traced(route_after_finalize),
        {
            "verify": "verify",
            "salvage": "salvage",
            "abort": "abort",
        },
    )

    g.add_conditional_edges(
        "verify",
        traced(after_verify),
        {
            END: END,
            "decide": "decide",
            "salvage": "salvage",
        },
    )

    g.add_edge("salvage", END)
    g.add_edge("abort", END)

    return g.compile()