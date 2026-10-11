from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

from agent.graph.execution_control import (
    check_budgets,
    fingerprint_tool_call,
    get_step,
    resolve_dependencies,
    validate_tool_allowed_for_step,
)
from agent.config.settings import MAX_TOOL_CHARS


def _json_payload(value: Any) -> str:
    return json.dumps(value, default=str, ensure_ascii=False)


def make_execute_node(tools, llm_with_tools, system: str):
    """
    One model decision for the current step, followed by validated tool execution.
    Compatible independent calls proposed in that decision may be executed in sequence.
    This is a reference implementation: adapt tool-specific input validation and
    SQL counting to your real tool wrappers.
    """
    by_name = {tool.name: tool for tool in tools}
    allowed_names = set(by_name)

    def execute(state):
        plan = state["plan"]
        step = get_step(plan, state.get("current_step_id"))
        if step is None:
            return {
                "next_action": "replan_or_abort",
                "last_error": "No valid current_step_id.",
            }

        dependency_outputs = resolve_dependencies(
            step, state.get("step_results") or {}
        )
        knowledge = state.get("knowledge") or {}
        relevant_knowledge = {
            kid: knowledge[kid]
            for kid in step.get("guide_ids", [])
            if kid in knowledge
        }

        # Include actual evidence records relevant to this step and its dependencies.
        # In production, cap/compact this payload and retrieve full evidence by ID
        # when a tool result is large.
        evidence_store = state.get("evidence") or {}
        prior_step_result = (state.get("step_results") or {}).get(step["id"], {})
        relevant_evidence_ids = list(prior_step_result.get("evidence_ids") or [])
        for dep in step.get("depends_on", []):
            dep_result = (state.get("step_results") or {}).get(dep["step_id"], {})
            relevant_evidence_ids.extend(dep_result.get("evidence_ids") or [])
        relevant_evidence = {
            eid: evidence_store[eid]
            for eid in dict.fromkeys(relevant_evidence_ids)
            if eid in evidence_store
        }

        # Use only relevant KB sections for this step. They are instructions,
        # never evidence.
        prompt = f"""
Current analytical step:
{_json_payload(step)}

Resolved dependency outputs:
{_json_payload(dependency_outputs)}

Current step's prior execution record:
{_json_payload(prior_step_result)}

Relevant evidence records:
{_json_payload(relevant_evidence)}

Relevant handbook guidance (methodology only):
{_json_payload(relevant_knowledge)}

Choose only actions needed to complete this step.
Do not repeat a successful identical tool call.
Use only tool_candidates listed in the current step.
Do not call submit_report from this node.
If the step needs no more tools, explain that in your response without requesting a tool.
"""

        llm_calls = int(state.get("llm_calls", 0)) + 1
        limits = plan.get("execution_limits") or {}
        if llm_calls > int(limits.get("max_llm_calls", 6)):
            return {
                "llm_calls": llm_calls - 1,
                "next_action": "abort",
                "last_error": "LLM-call budget reached.",
            }

        response = llm_with_tools.invoke([
            SystemMessage(content=system),
            HumanMessage(content=prompt),
        ])

        tool_calls = getattr(response, "tool_calls", []) or []
        evidence = dict(state.get("evidence") or {})
        cache = dict(state.get("tool_cache") or {})
        seen = list(state.get("seen_tool_fingerprints") or [])
        step_results = dict(state.get("step_results") or {})
        out_messages = []
        total_tool_calls = int(state.get("tool_calls", 0))
        sql_calls = int(state.get("sql_calls", 0))
        rejections = int(state.get("rejections", 0))
        produced_evidence_ids = []

        if not tool_calls:
            # The model can signal that this step is complete. Store its summary,
            # but do not treat the summary itself as business evidence.
            step_results[step["id"]] = {
                "status": "completed",
                "output_key": step["output_key"],
                "data": {
                    "summary": getattr(response, "content", ""),
                    "dependency_outputs": dependency_outputs,
                    "evidence_records": {
                        eid: evidence[eid]
                        for eid in dict.fromkeys(
                            produced_evidence_ids
                            + list(prior_step_result.get("evidence_ids") or [])
                        )
                        if eid in evidence
                    },
                },
                "evidence_ids": list(dict.fromkeys(
                    produced_evidence_ids
                    + list(prior_step_result.get("evidence_ids") or [])
                )),
            }
            return {
                "messages": [response],
                "step_results": step_results,
                "llm_calls": llm_calls,
                "completed_steps": int(state.get("completed_steps", 0)) + 1,
                "next_action": "select_step",
                "last_error": None,
            }

        # Execute calls in order. Tool-specific checks (RBAC, tenant/brand
        # isolation, SQL guard, PII guard, side-effect confirmation) remain required.
        for call in tool_calls:
            name = call["name"]
            args = call.get("args") or {}
            try:
                validate_tool_allowed_for_step(name, step, allowed_names)
                fp = fingerprint_tool_call(name, args)

                # Safe cache: only reuse results for explicitly read-only tools.
                tool = by_name[name]
                read_only = bool(getattr(tool, "read_only", False))
                if read_only and fp in cache and cache[fp].get("status") == "success":
                    cached = cache[fp]
                    out_messages.append(ToolMessage(
                        content=_json_payload({
                            "cached": True,
                            "evidence_id": cached.get("evidence_id"),
                            "result": cached.get("result"),
                        })[:MAX_TOOL_CHARS],
                        tool_call_id=call["id"],
                    ))
                    if cached.get("evidence_id"):
                        produced_evidence_ids.append(cached["evidence_id"])
                    continue

                if fp in seen:
                    rejections += 1
                    out_messages.append(ToolMessage(
                        content="Duplicate call rejected: identical tool and arguments were already attempted. Refine the query or use the stored result.",
                        tool_call_id=call["id"],
                        status="error",
                    ))
                    continue

                check_budgets(
                    {**state, "tool_calls": total_tool_calls, "sql_calls": sql_calls},
                    name,
                )

                # Count attempted invocations. SQL count is additionally enforced
                # inside the actual SQL tool immediately before DB execution.
                total_tool_calls += 1
                if name.lower() in {"run_sql", "query_database", "execute_sql"}:
                    sql_calls += 1
                seen.append(fp)

                result = tool.invoke(args)

                evidence_id = f"ev_{len(evidence) + 1}"
                evidence[evidence_id] = {
                    "tool": name,
                    "input": args,
                    "result": result,
                    "step_id": step["id"],
                }
                produced_evidence_ids.append(evidence_id)

                if read_only:
                    cache[fp] = {
                        "status": "success",
                        "tool": name,
                        "result": result,
                        "evidence_id": evidence_id,
                    }

                payload = _json_payload({
                    "evidence_id": evidence_id,
                    "result": result,
                })
                if len(payload) > MAX_TOOL_CHARS:
                    payload = payload[:MAX_TOOL_CHARS] + "... [truncated; refine the request]"
                out_messages.append(ToolMessage(
                    content=payload,
                    tool_call_id=call["id"],
                ))
            except Exception as exc:
                rejections += 1
                out_messages.append(ToolMessage(
                    content=f"Tool execution rejected or failed: {type(exc).__name__}: {exc}",
                    tool_call_id=call["id"],
                    status="error",
                ))

        # A tool result does not automatically mean the analytical step is done.
        # The next pass through this node can inspect the tool results, but this
        # design intentionally allows only one model invocation per graph pass.
        step_results[step["id"]] = {
            "status": "running",
            "output_key": step["output_key"],
            "data": {
                "dependency_outputs": dependency_outputs,
                "evidence_records": {
                    eid: evidence[eid]
                    for eid in dict.fromkeys(
                        produced_evidence_ids
                        + list(prior_step_result.get("evidence_ids") or [])
                    )
                    if eid in evidence
                },
                "latest_tool_message_summaries": [
                    getattr(message, "content", "") for message in out_messages
                ],
            },
            "evidence_ids": list(dict.fromkeys(
                produced_evidence_ids
                + list(prior_step_result.get("evidence_ids") or [])
            )),
        }

        return {
            "messages": [response, *out_messages],
            "evidence": evidence,
            "tool_cache": cache,
            "seen_tool_fingerprints": seen,
            "step_results": step_results,
            "tool_calls": total_tool_calls,
            "sql_calls": sql_calls,
            "rejections": rejections,
            "llm_calls": llm_calls,
            "next_action": "continue_current_step",
            "last_error": None,
        }

    return execute
