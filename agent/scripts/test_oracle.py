import argparse, json, os, time, requests
from dotenv import load_dotenv
load_dotenv()
from pinecone import Pinecone

from agent.security.context import TenantContext
from agent.graph.graph import build_graph
from agent.observability.tracing import (DebugHandler, cut, text_of,
                                         langfuse_config, flush_langfuse)

# =====================================================================
# ORACLE: loads the ground-truth sections (primary + supporting)
# =====================================================================
GROUND_TRUTH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "book_retrieval_map_v2.json")
JH = {"Authorization": f"Bearer {os.environ['JINA_API_KEY']}", "Content-Type": "application/json"}
index = Pinecone(api_key=os.environ["PINECONE_API_KEY"]).Index("marketing-kb-jina")

def get_section(chapter, section):
    for a in range(5):
        r = requests.post("https://api.jina.ai/v1/embeddings", headers=JH, timeout=120,
            json={"model": "jina-embeddings-v5-text-small", "input": [f"{chapter} {section}"],
                  "dimensions": 1024, "task": "retrieval.query"})
        if r.status_code not in (429, 500, 502, 503):
            break
        time.sleep(3 * (a + 1))
    r.raise_for_status()
    v = r.json()["data"][0]["embedding"]
    ms = index.query(namespace="handbook-md-jina-v5-small", vector=v, top_k=50, include_metadata=True,
                     filter={"chapter": {"$eq": chapter}, "section": {"$eq": section}})["matches"]
    return "\n\n".join(t for _, t in sorted((m["metadata"].get("ordinal", 0), m["metadata"]["text"]) for m in ms))

def load_oracle(qid="Q08"):
    gt = json.load(open(GROUND_TRUTH, encoding="utf-8"))["questions"][qid]
    kb, i = {}, 1
    for field in ("primary_sections", "supporting_sections"):
        for key in gt[field]:
            chapter, section = key.split(" > ", 1)
            text = get_section(chapter, section)
            print(f"  ORACLE {key}: {len(text)} chars")
            if not text:
                print("  MISSING IN INDEX:", key)
                continue
            kb[f"KB{i}"] = {"ref": key, "text": text,
                            "is_invented_example": "Worked Example" in section}
            i += 1
    print(f"ORACLE: {len(kb)} sections loaded, {sum(len(k['text']) for k in kb.values())} chars")
    return kb

# =====================================================================
# arguments
# =====================================================================
p = argparse.ArgumentParser()
p.add_argument("brand_id")
p.add_argument("question")
p.add_argument("--oracle", action="store_true", help="give the agent the ground-truth sections")
p.add_argument("--qid", default="Q08", help="ground-truth question id used with --oracle")
p.add_argument("--prompts", action="store_true", help="print the full prompt on every LLM call")
p.add_argument("--quiet", action="store_true", help="hide the model-call dump (Langfuse still records it)")
a = p.parse_args()

graph = build_graph(TenantContext(brand_id=a.brand_id))

handler = DebugHandler(full_prompt=a.prompts)
debug = [] if a.quiet else [handler]
lf = langfuse_config(a.brand_id, tags=["dev", "oracle" if a.oracle else "normal"])

config = {
    "recursion_limit": 60,
    "callbacks": debug + lf.get("callbacks", []),
    "metadata": lf.get("metadata", {}),
}

init = {
    "messages": [("user", a.question)],
    "user_request": a.question,

    "knowledge": load_oracle(a.qid) if a.oracle else {},     # <-- the only real change
    "plan": {},
    "current_step_id": None,
    "ready": False,

    "step_results": {},
    "evidence": {},
    "tool_cache": {},
    "seen_tool_fingerprints": [],

    "report": None,
    "steps": 0,
    "completed_steps": 0,
    "llm_calls": 0,
    "report_calls": 0,
    "tool_calls": 0,
    "sql_calls": 0,
    "tool_rejections": 0,
    "report_rejections": 0,
    "tokens_used": 0,
    "replans": 0,

    "next_action": "",
    "last_error": None,
    "verifier_feedback": None,

    "investigation_complete": False,
    "stop_reason": None,
}

seen_evidence, report, final_state = set(), None, {}

for mode, chunk in graph.stream(init, config=config, stream_mode=["updates", "values"]):
    if mode == "values":
        s = chunk
        final_state = chunk
        print(f"  STATE  steps={s.get('steps')} replans={s.get('replans')} "
              f"llm_calls={s.get('llm_calls')} report_calls={s.get('report_calls')} "
              f"report_rejections={s.get('report_rejections')} tool_rejections={s.get('tool_rejections')} "
              f"messages={len(s['messages'])} evidence={list(s['evidence'])}")
        continue

    for node, out in chunk.items():
        print(f"\n### NODE: {node}")
        if node in ("plan", "replan"):
            print("  PLAN:")
            print(json.dumps(out.get("plan", {}), indent=2, ensure_ascii=False, default=str))
        elif node == "decide":
            messages = out.get("messages", [])
            if messages:
                m = messages[0]
                note = text_of(m.content).strip()
                if note:
                    print("  MODEL SAID:", cut(note, 500))
                for c in getattr(m, "tool_calls", []):
                    print(f"  CALLS: {c['name']}  "
                          f"params={json.dumps(c['args'], ensure_ascii=False, default=str)}")
        elif node == "execute":
            for ev_id, ev in out.get("evidence", {}).items():
                if ev_id in seen_evidence:
                    continue
                seen_evidence.add(ev_id)
                print(f"  {ev_id}  tool={ev.get('tool', 'unknown')}")
                print(f"    input : {json.dumps(ev.get('input'), ensure_ascii=False, default=str)}")
                print("    result: " + cut(json.dumps(ev.get("result"), default=str, ensure_ascii=False), 1200))
            for m in out.get("messages", []):
                if getattr(m, "status", None) == "error":
                    print("  TOOL ERROR:", cut(str(m.content), 400))
        elif node == "verify":
            messages = out.get("messages", [])
            last = messages[-1] if messages else None
            print("  VERIFIER:",
                  "accepted" if out.get("report") else
                  cut(str(last.content), 800) if last else "No verifier message returned")
        elif node == "guide":
            for kid, k in out["knowledge"].items():
                if not isinstance(k, dict):
                    print(f"  {kid}: {k!r}")
                    continue
                tag = " [INVENTED EXAMPLE]" if k.get("is_invented_example", k.get("example", False)) else ""
                ref = k.get("ref") or " > ".join(
                    str(k[key]) for key in ("chapter", "section") if k.get(key)) or "(no reference)"
                text = k.get("text", k.get("content", ""))
                print(f"  {kid}: {ref}{tag}")
                if text:
                    print("    " + cut(str(text), 300).replace("\n", " "))
        if node == "salvage":
            rep = out.get("report") or {}
            print("  SALVAGE: run_status =", out.get("run_status"))
            print("  SALVAGE: findings kept =", len(rep.get("findings", [])))
            for item in rep.get("cannot_determine", []):
                print("    cannot_determine:", cut(str(item), 300))
        if node == "abort":
            print("  ABORT REASON:", out.get("last_error"))
            print("  ABORT OUTPUT:", json.dumps(out, indent=2, ensure_ascii=False, default=str))

        if out.get("last_error"):
            print("  LAST ERROR:", out["last_error"])
        if "next_action" in out:
            print("  NEXT ACTION:", out["next_action"])
        if out.get("report") is not None:
            report = out["report"]

print("\nFINAL DIAGNOSTICS")
for k in ("run_status", "last_error", "next_action", "llm_calls", "report_calls",
          "report_rejections", "tool_rejections", "tokens_used",
          "investigation_complete", "stop_reason"):
    print(f"  {k}:", final_state.get(k))
print("  report_in_state:", final_state.get("report") is not None)

print("\n" + "=" * 72 + "\nFINAL REPORT\n" + json.dumps(report, indent=2, ensure_ascii=False))
if debug:
    print(f"\nTOTAL: {handler.calls} model calls, tokens in={handler.tokens_in} out={handler.tokens_out}")

flush_langfuse()