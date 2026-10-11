
from typing import TypedDict, Annotated, Any
from langgraph.graph.message import add_messages


class AgentState(TypedDict, total=False):
    # Conversation
    messages: Annotated[list, add_messages]
    user_request: str

    # RAG handbook guidance; separate from business evidence
    knowledge: dict[str, Any]

    # Structured investigation plan
    plan: dict[str, Any]
    current_step_id: str | None
    ready: bool

    # step_id -> execution status, output, evidence IDs
    step_results: dict[str, Any]

    # evidence_id -> tool, input, result, step_id
    evidence: dict[str, Any]

    # Successful results from explicitly read-only tools only
    tool_cache: dict[str, Any]

    # Fingerprints of tool calls already attempted
    seen_tool_fingerprints: list[str]

    # Final validated report
    report: dict[str, Any] | None

    # Counters
    steps: int
    completed_steps: int
    llm_calls: int
    tool_calls: int
    sql_calls: int
    rejections: int
    replans: int

    # Routing/control
    next_action: str
    last_error: str | None
