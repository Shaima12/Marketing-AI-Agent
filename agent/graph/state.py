
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
    llm_calls: int            # investigation: plan + replan + execute
    report_calls: int         # report: decide only (separate budget)
    tool_calls: int
    sql_calls: int
    tool_rejections: int      # tool errors/duplicates in execute
    report_rejections: int    # verifier rejections of the report
    replans: int
    tokens_used: int          # running total (executor + decide)
    coverage_checks: int      # coverage-gate runs (used in a later step)

    # Routing/control
    next_action: str
    last_error: str | None
    verifier_feedback: str | None   # only the verifier's rejection text
    run_status: str
    partial_result: dict[str, Any] | None
    investigation_complete: bool
    stop_reason: str | None
    coverage: dict[str, Any]        # coverage-gate result (used in a later step)