from agent.tools.get_schema import make_get_schema
from agent.tools.run_sql import make_run_sql
from agent.tools.submit_report import make_submit_report
from agent.tools.retrieve_knowledge import make_retrieve_knowledge

def make_tools(ctx):
    # brand_id is baked into each tool here; the model can never choose it.
    # Later: search_reviews, retrieve_knowledge, compute_segments.
    return [make_get_schema(ctx), make_run_sql(ctx),
            make_retrieve_knowledge(), make_submit_report()]