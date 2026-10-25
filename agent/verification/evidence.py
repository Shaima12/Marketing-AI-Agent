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

def _tol(v: float) -> float:
    """Half a unit of the last significant digit the claim wrote."""
    s = f"{round(abs(v), 6):.6f}".rstrip("0")
    if s.endswith("."):                       # whole number
        digits = s[:-1]
        if abs(v) >= 1000:                    # 619000 -> approximation, tol 500
            zeros = len(digits) - len(digits.rstrip("0"))
            return 0.5 * 10 ** zeros
        return 0.5
    return 0.5 * 10 ** -len(s.split(".")[1])  # 38.3 -> 0.05, 57.57 -> 0.005


def supported(value: float, is_pct: bool, evidence_nums: list[float]) -> bool:
    t = _tol(value)
    cands = [(value, t)] + ([(value / 100, t / 100)] if is_pct else [])
    return any(abs(abs(c) - abs(e)) <= tol + 1e-9 for c, tol in cands for e in evidence_nums)