from agent.data.platform_db import platform, with_retry

SKIP = {"id", "user_id", "created_at", "updated_at"}

def load_profile(brand_id: str) -> dict:
    row = with_retry(
        lambda: platform().table("brands").select("*").eq("id", brand_id).single().execute()
    ).data
    return {k: v for k, v in row.items() if k not in SKIP and v not in (None, "", [], {})}

def banned_claims(profile: dict) -> list[str]:
    """Collects any column whose name contains 'banned' (adjust if yours differs)."""
    out = []
    for k, v in profile.items():
        if "banned" in k.lower():
            if isinstance(v, str):
                out += [x.strip() for x in v.replace("\n", ",").split(",") if x.strip()]
            elif isinstance(v, list):
                out += [str(x) for x in v]
    return out
    