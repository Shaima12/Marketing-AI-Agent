import argparse, json, os, time, datetime
from agent.security.context import TenantContext
from agent.graph.graph import build_graph
from agent.observability.tracing import (DebugHandler, cut, text_of,
                                         langfuse_config, flush_langfuse)

# --- arguments ---
p = argparse.ArgumentParser()
p.add_argument("brand_id")
p.add_argument("question")
p.add_argument("--qid", default=None, help="eval id, e.g. Q07. If set, the run is saved")
p.add_argument("--out", default="evals/results.json")
p.add_argument("--tag", default="dev", help="label for this code/glossary version")
p.add_argument("--prompts", action="store_true", help="print the full prompt on every LLM call")
p.add_argument("--quiet", action="store_true", help="hide the model-call dump (Langfuse still records it)")
a = p.parse_args()

graph = build_graph(
    TenantContext(brand_id=a.brand_id),
    user_question=a.question,
)

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

# --- collectors for the eval record ---
seen_evidence, report = set(), None
final_state = dict(init)
first_plan = None
raw_report_call = None      # submit_report args BEFORE verifier/repair
tool_errors = []
crash = []
t0 = time.time()


def events():
    """Wrap the stream so a crash (e.g. a 429) still lets us save what we have."""
    try:
        yield from graph.stream(init, config=config, stream_mode=["updates", "values"])
    except Exception as e:
        crash.append(f"{type(e).__name__}: {e}")
        print(f"\n!!! RUN CRASHED: {crash[0]}")


for mode, chunk in events():
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
            print(json.dumps(
                out.get("plan", {}),
                indent=2,
                ensure_ascii=False,
                default=str,
            ))
            if node == "plan" and first_plan is None:
                first_plan = out.get("plan")
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
                    if c["name"] == "submit_report":
                        raw_report_call = c["args"]
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
                    tool_errors.append(str(m.content))
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
                tag = " [INVENTED EXAMPLE]" if k.get("is_invented_example", k.get("example", False)) else ""
                ref = k.get("ref") or " > ".join(
                    str(k[key]) for key in ("chapter", "section") if k.get(key)
                ) or "(no reference)"
                text = k.get("text", k.get("content", ""))

                print(f"  {kid}: {ref}{tag}")
                if text:
                    print("    " + cut(str(text), 300).replace("\n", " "))
                else:
                    print(f"    Item fields: {k!r}")
        if node == "salvage":
            rep = out.get("report") or {}
            print("  SALVAGE: run_status =", out.get("run_status"))
            print("  SALVAGE: findings kept =", len(rep.get("findings", [])))
            for item in rep.get("cannot_determine", []):
                print("    cannot_determine:", cut(str(item), 300))
        if node == "abort":
            print("  ABORT REASON:", out.get("last_error"))
            print("  ABORT OUTPUT:", json.dumps(
                out, indent=2, ensure_ascii=False, default=str
            ))

        if "last_error" in out and out.get("last_error"):
            print("  LAST ERROR:", out["last_error"])

        if "next_action" in out:
            print("  NEXT ACTION:", out["next_action"])

        if out.get("report") is not None:
            report = out["report"]

print("\nFINAL DIAGNOSTICS")
print("  run_status:", final_state.get("run_status"))
print("  last_error:", final_state.get("last_error"))
print("  next_action:", final_state.get("next_action"))
print("  llm_calls (investigation):", final_state.get("llm_calls"))
print("  report_calls:", final_state.get("report_calls"))
print("  report_rejections:", final_state.get("report_rejections"))
print("  tool_rejections:", final_state.get("tool_rejections"))
print("  tokens_used (state):", final_state.get("tokens_used"))
print("  investigation_complete:", final_state.get("investigation_complete"))
print("  stop_reason:", final_state.get("stop_reason"))
print("  report_in_state:", final_state.get("report") is not None)

print("\n" + "=" * 72 + "\nFINAL REPORT\n" + json.dumps(report, indent=2, ensure_ascii=False))
if debug:
    print(f"\nTOTAL: {handler.calls} model calls, tokens in={handler.tokens_in} out={handler.tokens_out}")


# ----------------------------------------------------------------------
# Save the eval record (only when --qid is given)
# ----------------------------------------------------------------------
def knowledge_refs(k):
    out = {}
    for kid, v in (k or {}).items():
        if isinstance(v, dict):
            out[kid] = v.get("ref") or " > ".join(
                str(v[x]) for x in ("chapter", "section") if v.get(x))
        else:
            out[kid] = str(v)[:200]
    return out


import json, os, time, datetime

def _load(path):
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        return {}                                   # missing or empty file -> start clean
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        # corrupt file: keep a copy instead of crashing or overwriting it
        bad = f"{path}.corrupt-{datetime.datetime.now():%Y%m%d-%H%M%S}"
        os.replace(path, bad)
        print(f"WARNING: {path} was unreadable, moved to {bad}")
        return {}

def save_result(path, qid, record):
    data = _load(path)
    data.setdefault(qid, []).append(record)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)

    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        for attempt in range(5):                    # OneDrive can lock the file briefly
            try:
                os.replace(tmp, path)
                break
            except PermissionError:
                time.sleep(0.5 * (attempt + 1))
        else:
            raise PermissionError(f"could not replace {path}")
    except Exception as e:
        # last resort: never lose a run
        fallback = f"{path}.failed-{qid}-{datetime.datetime.now():%Y%m%d-%H%M%S}.json"
        with open(fallback, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2, ensure_ascii=False, default=str)
        print(f"SAVE FAILED ({e}). Run saved to {fallback}")
        return -1
    return len(data[qid])


if a.qid:
    record = {
        "qid": a.qid,
        "question": a.question,
        "brand_id": a.brand_id,
        "tag": a.tag,
        "timestamp": datetime.datetime.now().isoformat(timespec="seconds"),
        "seconds": round(time.time() - t0, 1),
        "status": final_state.get("run_status") or ("crashed" if crash else None),
        "crash": crash[0] if crash else None,

        "first_plan": first_plan,
        "plan": final_state.get("plan"),
        "evidence": final_state.get("evidence"),      # full rows, untruncated
        "tool_errors": tool_errors,
        "knowledge": knowledge_refs(final_state.get("knowledge")),

        "raw_report_call": raw_report_call,           # before verifier/repair
        "report": report,                             # final report

        "diagnostics": {
            "llm_calls": final_state.get("llm_calls"),
            "tool_calls": final_state.get("tool_calls"),
            "sql_calls": final_state.get("sql_calls"),
            "report_calls": final_state.get("report_calls"),
            "report_rejections": final_state.get("report_rejections"),
            "tool_rejections": final_state.get("tool_rejections"),
            "replans": final_state.get("replans"),
            "tokens_used_state": final_state.get("tokens_used"),
            "tokens_in": getattr(handler, "tokens_in", None) if debug else None,
            "tokens_out": getattr(handler, "tokens_out", None) if debug else None,
            "investigation_complete": final_state.get("investigation_complete"),
            "stop_reason": final_state.get("stop_reason"),
            "last_error": final_state.get("last_error"),
        },
    }
    n = save_result(a.out, a.qid, record)
    print(f"\nSAVED -> {a.out}  [{a.qid}]  runs for this question so far: {n}")

flush_langfuse()   # sends the buffered traces before the script exits