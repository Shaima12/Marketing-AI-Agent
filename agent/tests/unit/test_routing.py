from langchain_core.messages import AIMessage
from agent.graph.routing import after_decide, after_verify

def state(calls, **kw):
    s = dict(messages=[AIMessage(content="", tool_calls=calls)], steps=1,
             replans=0, rejections=0, report=None)
    s.update(kw); return s

def call(name): return [{"name": name, "args": {}, "id": "1"}]

def test_tool_goes_to_execute():  assert after_decide(state(call("run_sql"))) == "execute"
def test_submit_goes_to_verify(): assert after_decide(state(call("submit_report"))) == "verify"
def test_step_limit_aborts():     assert after_decide(state(call("run_sql"), steps=99)) == "abort"
def test_rejections_abort():      assert after_verify(state([], rejections=3)) == "abort"