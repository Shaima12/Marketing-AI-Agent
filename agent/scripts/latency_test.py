import sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from langchain_google_genai import ChatGoogleGenerativeAI
from agent.config.settings import MODEL


def run(model):
    llm = ChatGoogleGenerativeAI(
        model=model,
        temperature=0,
        max_output_tokens=200,
        thinking_level="low",
        max_retries=0,   # no hidden retries: errors show up
        timeout=60,      # give up after 60 seconds
    )
    start = time.time()
    try:
        reply = llm.invoke("Reply with the single word: ok")
        print(model, "OK in", round(time.time() - start, 1), "s", reply.usage_metadata)
    except Exception as e:
        print(model, "ERROR after", round(time.time() - start, 1), "s:", type(e).__name__, str(e)[:300])


for m in [MODEL, "gemini-3.6-flash"]:
    run(m)