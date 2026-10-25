from agent.graph.nodes.abort import abort
from agent.schemas.report import Report
from agent.verification.repair import repair_report


def _last_submit_args(messages):
    for message in reversed(messages or []):
        for call in getattr(message, "tool_calls", None) or []:
            if call.get("name") == "submit_report":
                return call.get("args") or {}
    return None


def make_salvage_node(banned):
    def salvage(state):
        args = _last_submit_args(state.get("messages"))
        evidence = state.get("evidence") or {}
        knowledge = state.get("knowledge") or {}

        if not args or not evidence:
            return abort(state)

        try:
            fixed, log = repair_report(args, evidence, banned, knowledge)
        except Exception:
            fixed, log = None, []

        if not fixed:
            out = abort(state)
            out["partial_result"]["rejected_report"] = args
            return out

        cannot = fixed["cannot_determine"]
        total = len(args.get("findings") or [])
        kept = len(fixed["findings"])
        if kept < total:
            cannot.append(
                f"{total - kept} of {total} claims were removed because they "
                "could not be verified against the evidence."
            )

        plan = state.get("plan") or {}
        results = state.get("step_results") or {}
        incomplete = [
            s["id"] for s in plan.get("steps", [])
            if (results.get(s["id"]) or {}).get("status") not in {"completed", "skipped"}
        ]
        if incomplete:
            cannot.append(
                f"Investigation stopped early ({state.get('stop_reason') or 'unspecified'}); "
                f"steps not completed: {incomplete}."
            )

        report = Report(**{**fixed, "cannot_determine": cannot})
        return {
            "report": report.model_dump(mode="json"),
            "run_status": "partial_verified",
            "repair_log": log,
            "last_error": f"Partial report: {kept}/{total} findings verified.",
        }

    return salvage