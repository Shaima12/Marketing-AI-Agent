import sys
from agent.retrieval.retrieval import search_handbook
from agent.llm.prompts import guide_block

items = search_handbook(sys.argv[1])
print("item keys:", list(items[0].keys()) if items and isinstance(items[0], dict) else type(items[0]))
knowledge = {f"KB{i+1}": it for i, it in enumerate(items)}
block = guide_block(knowledge)
print(f"retrieved {len(knowledge)} chunks; guide block = {len(block)} chars")
for k, v in knowledge.items():
    label = (v.get("ref") or " > ".join(str(v[x]) for x in ("chapter", "section") if v.get(x))) if isinstance(v, dict) else k
    print(("  IN  " if f"[{k}]" in block else "  OUT ") + k, label)