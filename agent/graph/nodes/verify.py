from langchain_core.messages import ToolMessage
from pydantic import ValidationError
from agent.verification.repair import repair_report
from agent.schemas.report import Report
from agent.verification.verifier import check_report


def _latest_ai_tool_calls(messages):
    """Tool calls of the most recent AI message (the one `decide` produced)."""
    for message in reversed(messages or []):
        if getattr(message, "type", "") == "ai":
            return getattr(message, "tool_calls", None) or []
    return []


def _format_feedback(problems: list[str], limit: int = 1500) -> str:
    return "\n".join(f"- {p}" for p in problems)[:limit]


def make_verify_node(banned):
    def verify(state):
        calls = _latest_ai_tool_calls(state.get("messages"))
        rejections = int(state.get("report_rejections", 0))

        submit_calls = [c for c in calls if c.get("name") == "submit_report"]
        extra_calls = [c for c in calls if c.get("name") != "submit_report"]

        def reject(problems, replies):
            feedback = _format_feedback(problems)
            return {
                "messages": replies,
                "report": None,
                "report_rejections": rejections + 1,
                "verifier_feedback": feedback,
                "last_error": feedback,
            }

        # Require exactly one submit_report call.
        if len(submit_calls) != 1:
            replies = [
                ToolMessage(
                    content="Rejected: expected exactly one submit_report call.",
                    tool_call_id=c["id"],
                    status="error",
                )
                for c in calls
            ]
            return reject(
                ["Verification requires exactly one submit_report tool call."],
                replies,
            )

        submit = submit_calls[0]

        # Every tool call in the AI message needs a matching ToolMessage.
        replies = [
            ToolMessage(
                content="Rejected: submit_report must be called alone.",
                tool_call_id=c["id"],
                status="error",
            )
            for c in extra_calls
        ]

        try:
            report = Report(**submit["args"])

            problems = check_report(
                report,
                state.get("evidence") or {},
                banned,
            )

            known_knowledge_ids = set((state.get("knowledge") or {}).keys())

            problems += [
                f"Knowledge citation {citation} was never retrieved."
                for citation in report.knowledge_citations
                if citation not in known_knowledge_ids
            ]

        except ValidationError as exc:
            report = None
            problems = [
                "Schema error at "
                + ".".join(str(part) for part in err["loc"])
                + f": {err['msg']}"
                for err in exc.errors()
            ][:5]

        except Exception as exc:
            # Fail closed: unexpected verifier failures must not accept
            # an unverified report.
            report = None
            problems = [f"Verification failed: {type(exc).__name__}: {exc}"]

        # Additional tool calls reject the report even if its contents pass.
        if extra_calls:
            problems.append(
                "submit_report must be called alone; "
                "additional tool calls were included."
            )
        if problems and report is not None and not extra_calls:
            evidence = state.get("evidence") or {}
            knowledge = state.get("knowledge") or {}
            try:
                fixed, log = repair_report(submit["args"], evidence, banned, knowledge)
            except Exception:
                fixed, log = None, []
            if fixed:
                try:
                    fixed_report = Report(**fixed)
                    if not check_report(fixed_report, evidence, banned):
                        replies.append(ToolMessage(content="accepted", tool_call_id=submit["id"]))
                        return {
                            "messages": replies,
                            "report": fixed_report.model_dump(mode="json"),
                            "run_status": "completed_with_repairs",
                            "repair_log": log,
                            "verifier_feedback": None,
                            "last_error": None,
                        }
                except Exception:
                    pass  # fall through to the normal rejection

        if problems:
            replies.append(
                ToolMessage(
                    content="Rejected: " + "; ".join(problems)[:1500],
                    tool_call_id=submit["id"],
                    status="error",
                )
            )
            return reject(problems, replies)

        replies.append(
            ToolMessage(content="accepted", tool_call_id=submit["id"])
        )

        return {
            "messages": replies,
            "report": report.model_dump(mode="json"),
            "run_status": "completed",
            "verifier_feedback": None,
            "last_error": None,
        }

    return verify