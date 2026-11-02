import json
import time
from pathlib import Path

from langchain_core.callbacks import BaseCallbackHandler

LOG_FILE = Path(__file__).resolve().parents[2] / "usage_log.txt"


class UsageLogger(BaseCallbackHandler):
    """Only records token numbers. Does not change the agent."""

    def on_llm_end(self, response, **kwargs):
        for generations in response.generations:
            for gen in generations:
                message = getattr(gen, "message", None)
                usage = getattr(message, "usage_metadata", None)
                if usage:
                    line = f"{time.strftime('%H:%M:%S')} {json.dumps(usage, default=str)}\n"
                    with open(LOG_FILE, "a", encoding="utf-8") as f:
                        f.write(line)