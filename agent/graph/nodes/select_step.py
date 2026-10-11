
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

        # Reflect the recorded execution status in the plan.
        for step in steps:
            result = results.get(step["id"], {})
            if result.get("status"):
                step["status"] = result["status"]

        plan["steps"] = steps

        if required_steps_complete(plan, results):
            return {
                "plan": plan,
                "ready": True,
                "current_step_id": None,
                "next_action": "finalize",
                "last_error": None,
            }

        next_step = select_next_step(plan, results)

        if next_step is None:
            return {
                "plan": plan,
                "ready": False,
                "current_step_id": None,
                "next_action": "replan",
                "last_error": (
                    "No eligible step remains, but required work is incomplete."
                ),
            }

        return {
            "plan": plan,
            "current_step_id": next_step["id"],
            "ready": False,
            "next_action": "execute",
            "last_error": None,
        }

    return select_step
