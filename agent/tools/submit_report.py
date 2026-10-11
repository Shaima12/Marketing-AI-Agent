from langchain_core.tools import StructuredTool
from agent.schemas.report import Report

def make_submit_report():
    return StructuredTool.from_function(
        func=lambda **kw: "handled by the verify node",
        name="submit_report",
        description="Final answer. Required to finish. Call it ALONE. "
                    "Every finding must cite evidence_ids returned by tools.",
        args_schema=Report,
    )