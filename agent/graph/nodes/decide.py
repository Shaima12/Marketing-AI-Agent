import json

from langchain_core.messages import SystemMessage, HumanMessage

from agent.config.settings import MAX_REPORT_CALLS
from agent.graph.nodes.execute import _compact_evidence


def _dump(value) -> str:
    return json.dumps(value, default=str, ensure_ascii=False)


def make_decide_node(llm_for_report, system: str):
    """
    Ask the model to emit exactly one submit_report tool call.

    - This node never executes the tool; `verify` validates the call.
    - It has its own budget (report_calls), independent of investigation.
    - Any failure routes to `salvage`, which recovers an earlier report if
      one exists and otherwise falls back to `abort`.
    """

    def decide(state):
        plan = state.get("plan") or {}
        knowledge = state.get("knowledge") or {}
        used_ids = sorted({g for s in plan.get("steps", []) for g in (s.get("guide_ids") or [])})
        kb_list = {}
        for k in used_ids:
            item = knowledge.get(k)
            if isinstance(item, dict):
                kb_list[k] = item.get("ref") or " > ".join(
                    str(item[x]) for x in ("chapter", "section") if item.get(x))

        report_calls = int(state.get("report_calls", 0))

        if report_calls >= MAX_REPORT_CALLS:
            return {
                "next_action": "salvage",
                "investigation_complete": False,
                "last_error": (
                    "Report-call budget exhausted "
                    f"({report_calls}/{MAX_REPORT_CALLS})."
                ),
            }

        evidence = state.get("evidence") or {}
        step_results = state.get("step_results") or {}

        # Compact view: status, evidence ids, short summary. The evidence
        # itself is sent once, below.
        step_overview = {
            sid: {
                "status": res.get("status"),
                "evidence_ids": res.get("evidence_ids") or [],
                "summary": (res.get("data") or {}).get("summary", ""),
            }
            for sid, res in step_results.items()
        }

        incomplete_steps = [
            step["id"]
            for step in plan.get("steps", [])
            if (step_results.get(step["id"]) or {}).get("status")
            not in {"completed", "skipped"}
        ]

        verifier_feedback = state.get("verifier_feedback")
        rejections = int(state.get("report_rejections", 0))
        incomplete = bool(incomplete_steps) or bool(state.get("stop_reason"))
        status_note = (
            "THE INVESTIGATION IS INCOMPLETE. Begin the summary with 'Preliminary:', "
            "do not state a firm verdict, and list each missing item in cannot_determine."
            if incomplete
            else "All planned steps were completed."
        )
        finalization_prompt = f"""
You must submit the final analytical report using the submit_report tool.

IMPORTANT:
- You must make a tool call named exactly submit_report.
- Do not answer with ordinary text instead of calling the tool.
- Do not call investigation tools.
- Use only the collected business evidence for business findings.
- Do not invent facts, calculations, evidence IDs, or causal explanations.

ORIGINAL QUESTION:
{state.get("user_request", "")}

INVESTIGATION OBJECTIVE:
{plan.get("objective", "")}

STEP OVERVIEW:
{_dump(step_overview)}

STEPS NOT COMPLETED:
{_dump(incomplete_steps)}

COLLECTED EVIDENCE (the only source of numbers):
{_dump(_compact_evidence(evidence, max_result_chars=12000))}

HANDBOOK SECTIONS (methodology only, never evidence; cite only these ids):
{_dump(kb_list)}

INVESTIGATION STATUS:
Complete: {state.get("investigation_complete", False)}
Stop reason: {state.get("stop_reason")}
Previous report rejections: {rejections}
{status_note}

PREVIOUS VERIFIER FEEDBACK:
{verifier_feedback or "None"}

REPORT REQUIREMENTS:
1. Every factual finding must cite the evidence IDs that support it.
2. Cite ALL evidence records containing any number used in a claim. If a
   claim mixes numbers from different records, cite each of them.
3. NUMBERS: every number in a claim, in the summary and in cannot_determine
   must appear verbatim in the cited evidence. Do NOT add, subtract, multiply,
   divide, round, or convert units or percentages. If a number you want is
   not in the evidence, state the point qualitatively or omit it.
4. Keep findings narrow when the evidence supports only a narrow claim.
5. COMPLETENESS: do not claim an analysis was completed if required evidence
   is missing. Describe every unanswered question, missing metric and
   incomplete step in plain words (never as step ids) in cannot_determine,
   and disclose the investigation's limitations.
6. A missing result does not prove that something did not happen.
7. Do not use handbook guidance as evidence of business results.
8. CAUSALITY: do not claim a cause unless the evidence tests it. Describe an
   untested pattern as "consistent with" a cause, never as proven.
9. ONE METRIC: do not base a verdict on a single metric when the evidence
   contains related metrics that point the other way.
10. Do not include evidence that is unrelated to the question.
11. Correct the issues identified in the previous verifier feedback, and
    check that your corrections do not introduce new unsupported numbers.
12. WINDOWS: if the evidence shows the same metric over several windows,
    mention all of them. Never present only the most favorable one.
13. COUNTER-EVIDENCE: the summary must include the strongest evidence that
    weakens your conclusion, next to the evidence that supports it.
14. BASE: state the base behind every rate or share (its definition and
    size), for example "segment A of N customers". The size must appear in
    the evidence.
15. EFFECT: a figure is not the effect of an action unless the evidence
    compares it with what would have happened otherwise. If it does not,
    describe the figure and do not credit the action.
16. COST: if the question involves an action and its cost, state the cost
    when the evidence contains it; otherwise write "cost not measured" in
    cannot_determine.
17. PROPORTIONAL VERDICT: match the strength of the verdict to the evidence.
    If anything essential is unmeasured, say so instead of declaring success
    or failure.
18. ACTIONS AND SUMMARY: every recommendation must follow from a cited
    finding. Do not introduce facts or numbers in the actions or the summary
    that are not in the findings.
19. LANGUAGE: write each claim as one plain business sentence. Copy numbers
    exactly as the evidence shows them, but never use column names in the
    text (write "78.98% of customers", not "customer_pct_of_total of 78.98").
20. COMPLETE ANSWER: answer every part of the question. If the question has
    two parts (for example who the best customers are and how to keep them),
    cover both. If a part cannot be answered, say so in cannot_determine.
21. PROFIT VERDICT: for promotions and pricing, base the verdict on gross
    profit after discount cost and after the post-sale period, not on
    revenue. State revenue lift and gross-profit lift side by side.
22. ASSUMPTIONS: put the definitions and windows used in cannot_determine's
    sibling field if one exists, otherwise end the summary with
    "Assumptions:" and list them, saying whether each came from the brand's
    settings or from a default.
23. CITATIONS: in knowledge_citations, list the KB ids whose method you
    followed, chosen from the list under HANDBOOK SECTIONS. Leave it empty
    only if none applies.
Now call submit_report with the completed report.
"""

        try:
            response = llm_for_report.invoke(
                [
                    SystemMessage(content=system),
                    HumanMessage(content=finalization_prompt),
                ]
            )
        except Exception as exc:
            return {
                "report_calls": report_calls + 1,
                "next_action": "salvage",
                "investigation_complete": False,
                "last_error": (
                    "Report finalization model invocation failed: "
                    f"{type(exc).__name__}: {exc}"
                ),
            }

        calls_used = report_calls + 1
        usage = getattr(response, "usage_metadata", None) or {}
        tokens_used = int(state.get("tokens_used", 0)) + int(
            usage.get("total_tokens", 0)
        )

        tool_calls = getattr(response, "tool_calls", None) or []
        invalid_tool_calls = (
            getattr(response, "invalid_tool_calls", None) or []
        )

        submit_calls = [
            c for c in tool_calls if c.get("name") == "submit_report"
        ]
        other_calls = [
            c for c in tool_calls if c.get("name") != "submit_report"
        ]

        if other_calls:
            other_names = [str(c.get("name", "<unnamed>")) for c in other_calls]
            return {
                "messages": [response],
                "report_calls": calls_used,
                "tokens_used": tokens_used,
                "next_action": "salvage",
                "investigation_complete": False,
                "last_error": (
                    "The report model called unexpected tool(s): "
                    f"{other_names}. Only submit_report is allowed "
                    "during finalization."
                ),
            }

        if len(submit_calls) == 0:
            content = getattr(response, "content", "")
            if not isinstance(content, str):
                content = str(content)

            invalid_names = [
                str(c.get("name", "<unnamed>")) for c in invalid_tool_calls
            ]
            diagnostic = (
                f"Invalid tool call(s) reported: {invalid_names}."
                if invalid_names
                else "No submit_report call was present in response.tool_calls."
            )

            return {
                "messages": [response],
                "report_calls": calls_used,
                "tokens_used": tokens_used,
                "next_action": "salvage",
                "investigation_complete": False,
                "last_error": (
                    "The finalization model did not request submit_report. "
                    f"{diagnostic} "
                    "Check that llm_for_report was created with "
                    "submit_report bound to it and that the model/provider "
                    "supports tool calling. "
                    f"Response content preview: {content[:800]!r}"
                ),
            }

        if len(submit_calls) > 1:
            return {
                "messages": [response],
                "report_calls": calls_used,
                "tokens_used": tokens_used,
                "next_action": "salvage",
                "investigation_complete": False,
                "last_error": (
                    "The finalization model requested submit_report more "
                    "than once in a single response. Expected exactly one "
                    f"call, received {len(submit_calls)}."
                ),
            }

        # Exactly one submit_report call: route to `verify`.
        return {
            "messages": [response],
            "report_calls": calls_used,
            "tokens_used": tokens_used,
            "steps": int(state.get("steps", 0)) + 1,
            "next_action": "finalize",
            "last_error": None,
        }

    return decide