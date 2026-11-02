"""Run one authenticated web-chat turn and stream compact NDJSON events."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from agent.observability.usage_log import UsageLogger
from agent.graph.graph import build_graph
from agent.observability.tracing import langfuse_config, flush_langfuse
from agent.security.context import TenantContext


def emit(event):
    print(json.dumps(event, ensure_ascii=False, default=str), flush=True)


def main():
    request = json.load(sys.stdin)
    question = str(request["question"]).strip()
    brand_id = str(request["brand_id"])
    conversation_id = str(request.get("conversation_id") or "web-chat")
    history = request.get("history") or []
    graph = build_graph(TenantContext(brand_id=brand_id), question)

    langfuse = {}
    try:
        langfuse = langfuse_config(
            brand_id,
            question_id=conversation_id,
            tags=["web", "chat"],
        )
    except Exception as exc:
        print(f"Langfuse tracing could not be initialized: {type(exc).__name__}: {exc}", file=sys.stderr)

    initial = {
        "messages": [("user", question)],
        "user_request": question,
        "conversation_context": history[-12:],
        "knowledge": {},
        "plan": {},
        "current_step_id": None,
        "ready": False,
        "step_results": {},
        "evidence": {},
        "tool_cache": {},
        "seen_tool_fingerprints": [],
        "report": None,
        "steps": 0,
        "completed_steps": 0,
        "llm_calls": 0,
        "report_calls": 0,
        "tool_calls": 0,
        "sql_calls": 0,
        "tool_rejections": 0,
        "report_rejections": 0,
        "tokens_used": 0,
        "replans": 0,
        "next_action": "",
        "last_error": None,
        "verifier_feedback": None,
        "investigation_complete": False,
        "stop_reason": None,
    }

    final_state = dict(initial)
    last_statuses = {}
    for mode, chunk in graph.stream(
        initial,
        config={
            "recursion_limit": 60,
            "callbacks": [UsageLogger(), *langfuse.get("callbacks", [])],
            "metadata": langfuse.get("metadata", {}),
        },
        stream_mode=["updates", "values"],
    ):
        if mode == "updates":
            for node, update in chunk.items():
                if node in ("plan", "replan") and update.get("plan"):
                    emit({"type": "plan", "plan": update["plan"]})
                elif node in ("execute", "select_step"):
                    emit({
                        "type": "working",
                        "node": node,
                        "step_id": update.get("current_step_id"),
                    })
        else:
            final_state = chunk
            plan = chunk.get("plan") or {}
            results = chunk.get("step_results") or {}
            for step in plan.get("steps", []):
                step_id = step.get("id")
                status = (results.get(step_id) or {}).get("status", step.get("status", "pending"))
                if last_statuses.get(step_id) != status:
                    last_statuses[step_id] = status
                    emit({"type": "step", "step_id": step_id, "status": status})

    report = final_state.get("report")
    partial = final_state.get("partial_result")
    emit({
        "type": "result",
        "report": report,
        "partial_result": partial,
        "plan": final_state.get("plan"),
        "run_status": final_state.get("run_status", "completed" if report else "aborted"),
        "error": final_state.get("last_error"),
    })


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
        raise
    finally:
        try:
            flush_langfuse()
        except Exception as exc:
            print(f"Langfuse trace flush failed: {type(exc).__name__}: {exc}", file=sys.stderr)
