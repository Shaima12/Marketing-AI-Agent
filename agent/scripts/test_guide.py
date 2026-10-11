# agent/scripts/test_guide.py
import sys
from agent.retrieval.knowledge import search

for h in search(sys.argv[1]):
    print(("[EXAMPLE] " if h["example"] else "") + h["ref"])
    print("   ", h["text"][:250].replace("\n", " "), "\n")