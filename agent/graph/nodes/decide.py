from langchain_core.messages import SystemMessage, HumanMessage
from agent.llm.prompts import guide_block

def make_decide_node(llm_with_tools, system):
    def decide(state):
        sys = SystemMessage(content=(
            f"{system}\n\n{guide_block(state.get('knowledge'))}\n\n# Current plan\n{state['plan']}"))
        msgs_in = list(state["messages"])
        if state.get("ready"):
            msgs_in.append(HumanMessage(content=
                "You have enough evidence. Call submit_report now. Do not run more queries."))
        res = llm_with_tools.invoke([sys] + msgs_in)
        msgs = [res]
        if not res.tool_calls:
            msgs.append(HumanMessage(content="Use a tool, or call submit_report to finish."))
        return {"messages": msgs, "steps": state["steps"] + 1}
    return decide
