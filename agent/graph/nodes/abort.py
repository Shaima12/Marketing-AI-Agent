

def abort(state):
    reason = (
        state.get("last_error")
        or "The investigation stopped before report verification."
    )

    evidence = state.get("evidence") or {}
    results = state.get("step_results") or {}

    completed_count = sum(
        1
        for result in results.values()
        if result.get("status") == "completed"
    )

    return {
        "report": None,
        "run_status": "aborted",
        "partial_result": {
            "summary": (
                "The investigation stopped before a verified "
                "answer could be produced."
            ),
            "completed_steps": completed_count,
            "evidence_count": len(evidence),
            "cannot_determine": [str(reason)],
        },
        "last_error": str(reason),
    }
