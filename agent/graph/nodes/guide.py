from agent.retrieval.knowledge import search

MAX_CHARS_PER_CHUNK = 900

def make_guide_node(search):
    def guide(state):
        if state.get("knowledge"):
            return {"knowledge": state["knowledge"]}
        question = state["messages"][0].content
        knowledge = {}
        for item in search(question):
            knowledge[f"KB{len(knowledge) + 1}"] = item
        return {"knowledge": knowledge}
    return guide