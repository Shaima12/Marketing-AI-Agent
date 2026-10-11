import json, re

NUM = re.compile(r"(?<![\w.])(-?\d[\d,]*(?:\.\d+)?)\s*(%|[kKmM]\b)?")

def evidence_numbers(result) -> list[float]:
    blob = json.dumps(result, default=str)
    return [float(m.group(1).replace(",", "")) for m in NUM.finditer(blob)]

def claim_numbers(text: str) -> list[tuple[float, bool]]:
    """Returns (value, is_percent). Skips years and small whole numbers."""
    out = []
    for m in NUM.finditer(text):
        raw, suffix = m.group(1), (m.group(2) or "").lower()
        v = float(raw.replace(",", ""))
        if suffix == "k": v *= 1_000
        if suffix == "m": v *= 1_000_000
        is_pct = suffix == "%"
        if not is_pct and v == int(v) and (abs(v) <= 10 or 1900 <= abs(v) <= 2100):
            continue
        out.append((v, is_pct))
    return out

def close(a: float, b: float) -> bool:
    a, b = abs(a), abs(b)
    return abs(a - b) <= max(0.01 * max(a, b), 0.005)

def supported(value: float, is_pct: bool, evidence_nums: list[float]) -> bool:
    candidates = [value] + ([value / 100] if is_pct else [])
    return any(close(c, e) for c in candidates for e in evidence_nums)