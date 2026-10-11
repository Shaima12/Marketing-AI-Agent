
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
from agent.graph.nodes.guide import make_guide_node
from agent.observability.tracing import traced
from agent.retrieval.retrieval import search_handbook


def build_graph(ctx):
    system, banned = build_system_prompt(ctx.brand_id)
    tools = make_tools(ctx)
    llm = get_llm()
    llm_with_tools = llm.bind_tools(tools)

    tool_catalog = "\n".join(
        f"- {tool.name}: {getattr(tool, 'description', '')}; "
        f"args={getattr(tool, 'args_schema', None)}"
        for tool in tools
    )

    g = StateGraph(AgentState)

    g.add_node("guide", make_guide_node(search_handbook))

    g.add_node(
        "plan",
        make_plan_node(llm, system, tool_catalog),
        retry_policy=RetryPolicy(max_attempts=3),
    )

    g.add_node("select_step", make_select_step_node())

    g.add_node(
        "execute",
        make_execute_node(tools, llm_with_tools, system),
    )

    g.add_node(
        "replan",
        make_replan_node(llm, system, tool_catalog),
        retry_policy=RetryPolicy(max_attempts=3),
    )

    # Used only to submit or revise the final report.
    g.add_node(
        "decide",
        make_decide_node(llm_with_tools, system),
        retry_policy=RetryPolicy(max_attempts=3),
    )

    g.add_node("verify", make_verify_node(banned))
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
        },
    )

    g.add_conditional_edges(
        "decide",
        traced(route_after_finalize),
        {
            "verify": "verify",
            "abort": "abort",
        },
    )

    g.add_conditional_edges(
        "verify",
        traced(after_verify),
        {
            END: END,
            "abort": "abort",
            "decide": "decide",
        },
    )

    g.add_edge("abort", END)

    return g.compile()
