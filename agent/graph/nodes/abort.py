def abort(state):
    return {"report": {
        "summary": "The run stopped before a verified answer was produced.",
        "findings": [], "actions": [], "knowledge_citations": [],
        "cannot_determine": ["Step or retry limit reached."],
    }}