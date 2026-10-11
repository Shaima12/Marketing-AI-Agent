import re
FORBIDDEN = r"\b(insert|update|delete|drop|alter|create|grant|copy|truncate|pg_sleep|dblink|pg_read_file|information_schema|pg_catalog|pg_stat_\w+)\b"
def check_sql(sql: str) -> str:
    s = sql.strip().rstrip(";").strip()
    if not re.match(r"^(select|with)\b", s, re.I):
        raise ValueError("Only a single SELECT is allowed.")
    if ";" in s or re.search(FORBIDDEN, s, re.I):
        raise ValueError("Forbidden query.")
    return s