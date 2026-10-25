from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

from agent.graph.execution_control import (
    ExecutionBudgetExceeded,
    check_budgets,
    fingerprint_tool_call,
    get_step,
    resolve_dependencies,
    validate_tool_allowed_for_step,
)
from agent.config.settings import (
    DEFAULT_MAX_LLM_CALLS,
    MAX_TOOL_CHARS,
    MAX_TOTAL_TOKENS,
    SQL_TOOL_NAMES,
    CACHEABLE_READ_ONLY_TOOLS,
)


def _json_payload(value: Any) -> str:
    return json.dumps(value, default=str, ensure_ascii=False)


def _as_text(content: Any) -> str:
    """Model content may be a string or a list of content blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(
            p.get("text", "") if isinstance(p, dict) else str(p)
            for p in content
        )
    return str(content or "")


def _compact_evidence(
    records: dict[str, Any],
    max_result_chars: int = 6000,
    max_input_chars: int = 500,
) -> dict[str, Any]:
    """Keep prompts small: truncate long SQL text and long results."""
    out: dict[str, Any] = {}
    for eid, rec in records.items():
        input_txt = _json_payload(rec.get("input"))
        result_txt = _json_payload(rec.get("result"))
        out[eid] = {
            "tool": rec.get("tool"),
            "input": (
                input_txt
                if len(input_txt) <= max_input_chars
                else input_txt[:max_input_chars] + "..."
            ),
            "result": (
                rec.get("result")
                if len(result_txt) <= max_result_chars
                else result_txt[:max_result_chars] + "... [truncated]"
            ),
            "step_id": rec.get("step_id"),
        }
    return out


def make_execute_node(tools, llm_with_tools, system: str):
    """
    Make one model decision for the current step, then execute validated tools.
    Compatible tool calls proposed in one response are executed sequentially.
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

        evidence_store = state.get("evidence") or {}
        prior_step_result = (
            state.get("step_results") or {}
        ).get(step["id"], {})

        relevant_evidence_ids = list(
            prior_step_result.get("evidence_ids") or []
        )
        for dep in step.get("depends_on", []):
            dep_result = (
                state.get("step_results") or {}
            ).get(dep["step_id"], {})
            relevant_evidence_ids.extend(
                dep_result.get("evidence_ids") or []
            )

        relevant_evidence = _compact_evidence(
            {
                eid: evidence_store[eid]
                for eid in dict.fromkeys(relevant_evidence_ids)
                if eid in evidence_store
            }
        )

        prompt = f"""
Current analytical step:
{_json_payload(step)}

Resolved dependency outputs:
{_json_payload(dependency_outputs)}

Current step's prior execution record (includes latest tool errors, if any):
{_json_payload(prior_step_result)}

Relevant evidence records:
{_json_payload(relevant_evidence)}

Relevant handbook guidance (methodology only):
{_json_payload(relevant_knowledge)}

Rules:
- Choose only actions needed to complete this step.
- Issue ALL independent queries for this step in ONE response (parallel tool calls).
- Do not run exploratory queries (date ranges, row counts, schema checks): the schema is already in the system prompt.
- In SQL, compute every number the final report may cite: totals, per-day values, differences, percentage changes, and combined-window totals. The report is not allowed to do arithmetic.
- If a previous call failed, read latest_errors in the execution record and fix the query. Do not repeat it unchanged.
- Do not repeat a successful identical tool call.
- Use only tool_candidates listed in the current step.
- Do not call submit_report from this node.
- When the step needs no more tools, reply with ONE sentence (max 40 words):
  "STEP COMPLETE: <evidence ids that answer the objective>".
  No analysis, tables or recommendations: the report is written later.
"""

        limits = plan.get("execution_limits") or {}
        max_llm_calls = int(
            limits.get("max_llm_calls", DEFAULT_MAX_LLM_CALLS)
        )
        current_llm_calls = int(state.get("llm_calls", 0))
        tokens_used = int(state.get("tokens_used", 0))

        # The report has its own budget (report_calls), so no reserve here.
        calls_exhausted = current_llm_calls >= max_llm_calls
        tokens_exhausted = tokens_used >= MAX_TOTAL_TOKENS

        if calls_exhausted or tokens_exhausted:
            return {
                "ready": True,
                "investigation_complete": False,
                "stop_reason": (
                    "llm_budget_exhausted"
                    if calls_exhausted
                    else "token_budget_exhausted"
                ),
                "next_action": "finalize",
                "last_error": (
                    "Investigation budget reached. "
                    "Required steps may remain incomplete. "
                    "Finalize using the evidence already collected "
                    "and disclose any limitations."
                ),
            }

        llm_calls = current_llm_calls + 1

        try:
            response = llm_with_tools.invoke(
                [
                    SystemMessage(content=system),
                    HumanMessage(content=prompt),
                ]
            )
        except Exception as exc:
            return {
                "llm_calls": llm_calls,
                "next_action": "abort",
                "last_error": (
                    f"Investigation model call failed: "
                    f"{type(exc).__name__}: {exc}"
                ),
            }

        usage = getattr(response, "usage_metadata", None) or {}
        tokens_used += int(usage.get("total_tokens", 0))

        tool_calls = getattr(response, "tool_calls", []) or []

        evidence = dict(state.get("evidence") or {})
        cache = dict(state.get("tool_cache") or {})
        seen = list(state.get("seen_tool_fingerprints") or [])
        step_results = dict(state.get("step_results") or {})

        out_messages = []
        total_tool_calls = int(state.get("tool_calls", 0))
        sql_calls = int(state.get("sql_calls", 0))
        tool_rejections = int(state.get("tool_rejections", 0))

        produced_evidence_ids = []

        # ---------- No tool calls: the model says the step is done ----------
        if not tool_calls:
            summary = _as_text(getattr(response, "content", ""))[:300]

            existing_ids = list(
                dict.fromkeys(
                    list(prior_step_result.get("evidence_ids") or [])
                )
            )

            needs_tools = bool(step.get("tool_candidates"))
            has_evidence = any(
                eid in evidence_store for eid in existing_ids
            )

            if needs_tools and not has_evidence:
                step_results[step["id"]] = {
                    "status": "failed",
                    "output_key": step["output_key"],
                    "data": {
                        "summary": summary,
                        "reason": (
                            "The model requested no further tools, but this "
                            "step has not produced supporting evidence."
                        ),
                    },
                    "evidence_ids": existing_ids,
                }

                return {
                    "messages": [response],
                    "step_results": step_results,
                    "llm_calls": llm_calls,
                    "tokens_used": tokens_used,
                    "next_action": "replan",
                    "last_error": (
                        f"Step {step['id']} ended without supporting evidence."
                    ),
                }

            step_results[step["id"]] = {
                "status": "completed",
                "output_key": step["output_key"],
                "data": {"summary": summary},
                "evidence_ids": existing_ids,
            }

            return {
                "messages": [response],
                "step_results": step_results,
                "llm_calls": llm_calls,
                "tokens_used": tokens_used,
                "completed_steps": int(
                    state.get("completed_steps", 0)
                ) + 1,
                "next_action": "select_step",
                "last_error": None,
            }

        # ---------- Tool calls: execute in order ----------
        budget_exhausted = False
        budget_error = None

        for call in tool_calls:
            name = call["name"]
            args = call.get("args") or {}

            if budget_exhausted:
                out_messages.append(
                    ToolMessage(
                        content=(
                            "Tool not executed because the execution "
                            "budget was already exhausted."
                        ),
                        tool_call_id=call["id"],
                        name=name,
                        status="error",
                    )
                )
                continue

            try:
                validate_tool_allowed_for_step(
                    name, step, allowed_names
                )

                fp = fingerprint_tool_call(name, args)
                tool = by_name[name]
                read_only = (
                    name in CACHEABLE_READ_ONLY_TOOLS
                    or bool(getattr(tool, "read_only", False))
                )

                if (
                    read_only
                    and fp in cache
                    and cache[fp].get("status") == "success"
                ):
                    cached = cache[fp]

                    out_messages.append(
                        ToolMessage(
                            content=_json_payload(
                                {
                                    "cached": True,
                                    "evidence_id": cached.get("evidence_id"),
                                    "result": cached.get("result"),
                                }
                            )[:MAX_TOOL_CHARS],
                            tool_call_id=call["id"],
                            name=name,
                        )
                    )

                    if cached.get("evidence_id"):
                        produced_evidence_ids.append(
                            cached["evidence_id"]
                        )

                    continue

                if fp in seen:
                    tool_rejections += 1
                    out_messages.append(
                        ToolMessage(
                            content=(
                                "Duplicate call rejected: identical tool "
                                "and arguments were already attempted. "
                                "Refine the query or use the stored result."
                            ),
                            tool_call_id=call["id"],
                            name=name,
                            status="error",
                        )
                    )
                    continue

                check_budgets(
                    {
                        **state,
                        "tool_calls": total_tool_calls,
                        "sql_calls": sql_calls,
                    },
                    name,
                )

                total_tool_calls += 1

                if name in SQL_TOOL_NAMES:
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

                payload = _json_payload(
                    {
                        "evidence_id": evidence_id,
                        "result": result,
                    }
                )

                if len(payload) > MAX_TOOL_CHARS:
                    payload = (
                        payload[:MAX_TOOL_CHARS]
                        + "... [truncated; refine the request]"
                    )

                out_messages.append(
                    ToolMessage(
                        content=payload,
                        tool_call_id=call["id"],
                        name=name,
                    )
                )

            except ExecutionBudgetExceeded as exc:
                budget_exhausted = True
                budget_error = str(exc)

                out_messages.append(
                    ToolMessage(
                        content=f"Execution budget exhausted: {exc}",
                        tool_call_id=call["id"],
                        name=name,
                        status="error",
                    )
                )

            except Exception as exc:
                tool_rejections += 1

                out_messages.append(
                    ToolMessage(
                        content=(
                            "Tool execution rejected or failed: "
                            f"{type(exc).__name__}: {exc}"
                        ),
                        tool_call_id=call["id"],
                        name=name,
                        status="error",
                    )
                )

        combined_evidence_ids = list(
            dict.fromkeys(
                produced_evidence_ids
                + list(prior_step_result.get("evidence_ids") or [])
            )
        )

        # Errors from THIS pass only. The next model call reads them here,
        # because tool messages are not replayed to the model.
        latest_errors = [
            str(m.content)[:300]
            for m in out_messages
            if getattr(m, "status", "success") == "error"
        ]

        # Lookup steps can complete without an extra "I'm done" LLM call.
        auto_done = (
            bool(step.get("auto_complete_on_success"))
            and bool(produced_evidence_ids)
            and not latest_errors
            and not budget_exhausted
        )

        step_results[step["id"]] = {
            "status": "completed" if auto_done else "running",
            "output_key": step["output_key"],
            "data": {
                "summary": (
                    "Auto-completed after successful tool call."
                    if auto_done
                    else ""
                ),
                "latest_errors": latest_errors,
            },
            "evidence_ids": combined_evidence_ids,
        }

        if budget_exhausted:
            next_action = "finalize"
        elif auto_done:
            next_action = "select_step"
        else:
            next_action = "continue_current_step"

        return {
            "messages": [response, *out_messages],
            "evidence": evidence,
            "tool_cache": cache,
            "seen_tool_fingerprints": seen,
            "step_results": step_results,
            "tool_calls": total_tool_calls,
            "sql_calls": sql_calls,
            "tool_rejections": tool_rejections,
            "llm_calls": llm_calls,
            "tokens_used": tokens_used,
            "completed_steps": (
                int(state.get("completed_steps", 0)) + 1
                if auto_done
                else int(state.get("completed_steps", 0))
            ),
            "ready": bool(state.get("ready")) or budget_exhausted,
            "investigation_complete": (
                False
                if budget_exhausted
                else state.get("investigation_complete", False)
            ),
            "stop_reason": (
                "tool_budget_exhausted"
                if budget_exhausted
                else state.get("stop_reason")
            ),
            "next_action": next_action,
            "last_error": (
                budget_error if budget_exhausted else None
            ),
        }

    return execute