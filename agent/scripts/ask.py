import argparse, json
from agent.security.context import TenantContext
from agent.graph.graph import build_graph
from agent.observability.tracing import (DebugHandler, cut, text_of,
                                         langfuse_config, flush_langfuse)

# --- arguments: brand_id and question, plus two optional switches ---
p = argparse.ArgumentParser()
p.add_argument("brand_id")
p.add_argument("question")
p.add_argument("--prompts", action="store_true", help="print the full prompt on every LLM call")
p.add_argument("--quiet", action="store_true", help="hide the model-call dump (Langfuse still records it)")
a = p.parse_args()

graph = build_graph(TenantContext(brand_id=a.brand_id))

# --- tracing: terminal debug output + Langfuse ---
handler = DebugHandler(full_prompt=a.prompts)
debug = [] if a.quiet else [handler]
lf = langfuse_config(a.brand_id, tags=["dev"])

config = {
    "recursion_limit": 60,
    "callbacks": debug + lf.get("callbacks", []),
    "metadata": lf.get("metadata", {}),
}


init = {
    "messages": [("user", a.question)],
    "user_request": a.question,

    "knowledge": {},
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
    "tool_calls": 0,
    "sql_calls": 0,
    "rejections": 0,
    "replans": 0,

    "next_action": "",
    "last_error": None,
}


seen_evidence, report = set(), None

for mode, chunk in graph.stream(init, config=config, stream_mode=["updates", "values"]):
    if mode == "values":
        s = chunk
        print(f"  STATE  steps={s['steps']} replans={s['replans']} rejections={s['rejections']} "
              f"messages={len(s['messages'])} evidence={list(s['evidence'])}")
        continue

    for node, out in chunk.items():
        print(f"\n### NODE: {node}")
        if node in ("plan", "replan"):
            print("  PLAN:")
            print(json.dumps(
                out.get("plan", {}),
                indent=2,
                ensure_ascii=False,
                default=str,
            ))
        elif node == "decide":
                messages = out.get("messages", [])
                if messages:
                    m = messages[0]
                    note = text_of(m.content).strip()
                    if note:
                        print("  MODEL SAID:", cut(note, 500))
                    for c in getattr(m, "tool_calls", []):
                        print(
                            f"  CALLS: {c['name']}  "
                            f"params={json.dumps(c['args'], ensure_ascii=False, default=str)}"
                        )
        elif node == "execute":
            for ev_id, ev in out.get("evidence", {}).items():
                if ev_id in seen_evidence:
                    continue
                seen_evidence.add(ev_id)
                print(f"  {ev_id}  tool={ev.get('tool', 'unknown')}")
                print(f"    input : {json.dumps(ev.get('input'), ensure_ascii=False, default=str)}")
                print(
                    "    result: "
                    + cut(
                        json.dumps(ev.get("result"), default=str, ensure_ascii=False),
                        1200,
                    )
                )
            for m in out.get("messages", []):
                if getattr(m, "status", None) == "error":
                    print("  TOOL ERROR:", cut(str(m.content), 400))

        elif node == "verify":
            messages = out.get("messages", [])
            last = messages[-1] if messages else None
            print(
                "  VERIFIER:",
                "accepted" if out.get("report") else
                cut(str(last.content), 800) if last else "No verifier message returned"
            )
        elif node == "guide":
            for kid, k in out["knowledge"].items():
                if not isinstance(k, dict):
                    print(f"  {kid}: {k!r}")
                    continue
                tag = " [INVENTED EXAMPLE]" if k.get("example", False) else ""
                ref = k.get("ref") or " > ".join(
                    str(k[key]) for key in ("chapter", "section") if k.get(key)
                ) or "(no reference)"
                text = k.get("text", k.get("content", ""))

                print(f"  {kid}: {ref}{tag}")
                if text:
                    print("    " + cut(str(text), 300).replace("\n", " "))
                else:
                    print(f"    Item fields: {k!r}")
        if out.get("report"):
            report = out["report"]

print("\n" + "=" * 72 + "\nFINAL REPORT\n" + json.dumps(report, indent=2, ensure_ascii=False))
if debug:
    print(f"\nTOTAL: {handler.calls} model calls, tokens in={handler.tokens_in} out={handler.tokens_out}")

flush_langfuse()   # sends the buffered traces before the script exits