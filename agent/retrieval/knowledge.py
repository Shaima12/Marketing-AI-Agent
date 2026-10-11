# agent/retrieval/__init__.py must exist (empty)
from agent.retrieval.retrieval import search_handbook

def search(query: str, k: int = 25, max_chars: int = 1800) -> list[dict]:
    """Handbook sections for a query, trimmed. Never raises into the agent."""
    try:
        # lazy import: retrieval.py needs JINA/GROQ/PINECONE keys at import time
        hits = search_handbook(query, top_sections=k)
    except Exception as e:
        print(f"  [knowledge] retrieval failed: {str(e)[:150]}")
        return []
    return [{
        "ref": f"{h['chapter']} > {h['section']}",
        "example": bool(h.get("is_invented_example")),
        "text": h["text"][:max_chars],
    } for h in hits]