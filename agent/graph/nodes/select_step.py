
from agent.graph.execution_control import (
    select_next_step,
    required_steps_complete,
)


def make_select_step_node():
    def select_step(state):
        plan = dict(state.get("plan") or {})
        steps = [dict(step) for step in plan.get("steps", [])]
        results = dict(state.get("step_results") or {})

        if not steps:
            return {
                "next_action": "replan",
                "last_error": "The investigation plan has no steps.",
            }

        # Initialize missing statuses and synchronize completed results.
        for step in steps:
            result = results.get(step["id"], {})
            step["status"] = result.get(
                "status",
                step.get("status", "pending"),
            )

        plan["steps"] = steps

        # Finish only when every required step is complete or validly skipped.
        if required_steps_complete(plan, results):
            return {
                "plan": plan,
                "ready": True,
                "current_step_id": None,
                "next_action": "finalize",
                "investigation_complete": True,
                "stop_reason": None,
                "last_error": None,
            }

        next_step = select_next_step(plan, results)

        if next_step is None:
            return {
                "plan": plan,
                "ready": False,
                "current_step_id": None,
                "next_action": "replan",
                "investigation_complete": False,
                "last_error": (
                    "No eligible step remains, but required work is incomplete."
                ),
            }

        return {
            "plan": plan,
            "current_step_id": next_step["id"],
            "ready": False,
            "next_action": "execute",
            "investigation_complete": False,
            "last_error": None,
        }

    return select_step
