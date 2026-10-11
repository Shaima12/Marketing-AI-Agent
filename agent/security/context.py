from dataclasses import dataclass

@dataclass(frozen=True)
class TenantContext:
    brand_id: str   # set by your code from the session, never by the model