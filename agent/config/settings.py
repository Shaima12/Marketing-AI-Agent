import os
from dotenv import load_dotenv
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_FILE)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SECRET_SUPABASE_KEY"]
CREDENTIALS_KEY = os.environ["CREDENTIALS_KEY"]
MODEL = os.environ["MODEL"]
ROW_CAP = 200
STATEMENT_TIMEOUT_MS = 10_000
MAX_STEPS = 20
MAX_REJECTIONS = 3
REPLAN_EVERY = 4     # replan after every 4 decide steps
MAX_REPLANS = 4      # hard cap so replanning cannot loop or burn tokens
MAX_TOOL_CHARS = 12000
MAX_RESULT_CHARS = 12000
MAX_PLAN_STEPS = 8
DEFAULT_MAX_TOOL_CALLS = 10
DEFAULT_MAX_SQL_CALLS = 8
DEFAULT_MAX_REPLANS = 2
DEFAULT_MAX_LLM_CALLS = 8

# Explicit list is safer than guessing by tool name. Set this to your real tool names.
SQL_TOOL_NAMES = {"run_sql"}
# Only tools confirmed to be side-effect-free should be cacheable.
CACHEABLE_READ_ONLY_TOOLS = {
    "run_sql",
    "get_schema",
    "retrieve_knowledge"
}
