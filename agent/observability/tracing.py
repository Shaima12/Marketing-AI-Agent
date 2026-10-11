import json
import os
import re
import time
from functools import wraps
from langchain_core.callbacks import BaseCallbackHandler


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

def cut(s, n=600):
    s = str(s)
    return s if len(s) <= n else s[:n] + f"... [+{len(s) - n} chars]"


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    parts = []
    for b in content:
        if isinstance(b, dict):
            parts.append(b.get("text") or json.dumps(b, default=str))
    return "".join(parts)


# ---------------------------------------------------------------
# Terminal debug: prints every model call (input and output)
# ---------------------------------------------------------------

class DebugHandler(BaseCallbackHandler):
    """Prints every model call and writes trace.jsonl."""

    def __init__(self, full_prompt: bool = False, path: str = "trace.jsonl"):
        self.full_prompt = full_prompt
        self.calls = 0
        self.tokens_in = 0
        self.tokens_out = 0
        self.f = open(path, "a", encoding="utf-8")

    def _log(self, kind, **data):
        self.f.write(json.dumps({"t": time.time(), "kind": kind, **data}, default=str) + "\n")
        self.f.flush()

    def on_chat_model_start(self, serialized, messages, **kwargs):
        self.calls += 1
        msgs = messages[0]
        print(f"\n{'=' * 72}\nLLM CALL #{self.calls}  ({len(msgs)} messages sent)")
        for i, m in enumerate(msgs):
            body = text_of(m.content)
            if m.type == "system" and not self.full_prompt:
                shown = cut(body, 300) + f"\n      (system prompt = {len(body)} chars; use --prompts to see all)"
            else:
                shown = body if self.full_prompt else cut(body, 500)
            extra = ""
            if getattr(m, "tool_calls", None):
                extra = "  tool_calls=" + json.dumps(
                    [{"name": c["name"], "args": c["args"]} for c in m.tool_calls])[:400]
            print(f"  [{i}] {m.type.upper()}: {shown}{extra}")
        self._log("llm_start", messages=[{"type": m.type, "content": text_of(m.content)} for m in msgs])

    def on_llm_end(self, response, **kwargs):
        msg = response.generations[0][0].message
        usage = getattr(msg, "usage_metadata", None) or {}
        self.tokens_in += usage.get("input_tokens", 0)
        self.tokens_out += usage.get("output_tokens", 0)
        print(f"  <- MODEL REPLY: {cut(text_of(msg.content), 700) or '(no text)'}")
        for c in getattr(msg, "tool_calls", []) or []:
            print(f"  <- TOOL CALL: {c['name']}  args={json.dumps(c['args'], ensure_ascii=False)}")
        print(f"  tokens this call: in={usage.get('input_tokens', '?')} out={usage.get('output_tokens', '?')}"
              f"   running total: in={self.tokens_in} out={self.tokens_out}")
        self._log("llm_end", text=text_of(msg.content),
                  tool_calls=getattr(msg, "tool_calls", []), usage=usage)


# ---------------------------------------------------------------
# Routing trace: prints each decision between nodes
# ---------------------------------------------------------------

def traced(fn):
    """Wraps a routing function so each decision is printed."""
    @wraps(fn)
    def wrapper(state):
        dest = fn(state)
        print(f"  ROUTE {fn.__name__}: steps={state['steps']} replans={state['replans']} "
              f"rejections={state['rejections']}  ->  {dest}")
        return dest
    return wrapper


# ---------------------------------------------------------------
# Langfuse
# ---------------------------------------------------------------

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _mask(data, **kwargs):
    """Optional: hide emails before data leaves your machine."""
    if isinstance(data, str):
        return EMAIL.sub("[email]", data)
    return data


def langfuse_enabled() -> bool:
    return bool(os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"))


def langfuse_config(brand_id: str, question_id: str | None = None,
                    tags: list[str] | None = None) -> dict:
    """Returns the LangGraph config fragment that turns on Langfuse tracing."""
    if not langfuse_enabled():
        return {}
    from langfuse.langchain import CallbackHandler
    return {
        "callbacks": [CallbackHandler()],
        "metadata": {
            "langfuse_user_id": brand_id,
            "langfuse_session_id": f"{brand_id}:{question_id or 'adhoc'}",
            "langfuse_tags": ["marketing-agent", *(tags or [])],
        },
    }


def flush_langfuse():
    if langfuse_enabled():
        from langfuse import get_client
        get_client().flush()   # sends buffered events before the script exits