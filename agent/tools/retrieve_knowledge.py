from langchain_core.tools import tool
from agent.retrieval.knowledge import search

def make_retrieve_knowledge():
    @tool
    def retrieve_knowledge(query: str) -> list:
        """Search the marketing handbook for METHOD and ADVICE (how to analyse, what to recommend).
        Use it after you have findings, with a concrete query such as
        'win-back offers for lapsing repeat buyers' or 'judging a promotion's profitability'.
        Returns guidance, NOT data. Never cite it as evidence and never use numbers from it."""
        return search(query, k=3)
    return retrieve_knowledge