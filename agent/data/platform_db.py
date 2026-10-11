import time
import httpx
from supabase import create_client
from agent.config.settings import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

_client = None

def platform():
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        # longer timeout on the underlying PostgREST client
        try:
            _client.postgrest.session.timeout = httpx.Timeout(30.0, connect=15.0)
        except Exception:
            pass
    return _client

def with_retry(fn, tries: int = 3, delay: float = 2.0):
    """Retry a platform call on network errors."""
    for i in range(tries):
        try:
            return fn()
        except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError):
            if i == tries - 1:
                raise
            time.sleep(delay * (i + 1))