from langchain_core.tools import tool
from agent.data.introspection import schema_text

def make_get_schema(ctx):
    @tool
    def get_schema() -> str:
        """List the tables and columns you may query, with the owner's descriptions and rules."""
        return schema_text(ctx.brand_id)
    return get_schema