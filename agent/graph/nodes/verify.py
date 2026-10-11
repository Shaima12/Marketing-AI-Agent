
from langchain_core.messages import ToolMessage
from pydantic import ValidationError

from agent.schemas.report import Report
from agent.verification.verifier import check_report


def make_verify_node(banned):
    def verify(state):
        messages = state.get("messages") or []
        calls = (
            getattr(messages[-1], "tool_calls", None) or []
            if messages
            else []
        )

        submit = next(
            (
                call for call in calls
                if call.get("name") == "submit_report"
            ),
            None,
        )

        # Defensive check: the graph should normally route only a
        # submit_report call here.
        if submit is None:
            return {
                "rejections": state.get("rejections", 0) + 1,
                "last_error": (
                    "Verification requires a submit_report tool call."
                ),
                "report": None,
            }

        # Every tool call in the AI message needs a matching ToolMessage.
        replies = [
            ToolMessage(
                content="Rejected: submit_report must be called alone.",
                tool_call_id=call["id"],
                status="error",
            )
            for call in calls
            if call.get("name") != "submit_report"
        ]

        try:
            report = Report(**submit["args"])

            problems = check_report(
                report,
                state.get("evidence") or {},
                banned,
            )

            known_knowledge_ids = set(
                (state.get("knowledge") or {}).keys()
            )

            problems += [
                f"Knowledge citation {citation} was never retrieved."
                for citation in report.knowledge_citations
                if citation not in known_knowledge_ids
            ]

        except ValidationError as exc:
            report = None
            problems = [str(exc)[:300]]

        except Exception as exc:
            # Fail closed: unexpected verifier failures must not accept
            # an unverified report.
            report = None
            problems = [
                f"Verification failed: {type(exc).__name__}: {exc}"
            ]

        if problems:
            replies.append(
                ToolMessage(
                    content="Rejected: " + "; ".join(problems),
                    tool_call_id=submit["id"],
                    status="error",
                )
            )

            return {
                "messages": replies,
                "report": None,
                "rejections": state.get("rejections", 0) + 1,
                "last_error": "; ".join(problems),
            }

        replies.append(
            ToolMessage(
                content="accepted",
                tool_call_id=submit["id"],
            )
        )

        return {
            "messages": replies,
            "report": report.model_dump(mode="json"),
            "last_error": None,
        }

    return verify
