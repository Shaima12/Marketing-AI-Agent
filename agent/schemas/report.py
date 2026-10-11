from pydantic import BaseModel, Field

class Finding(BaseModel):
    claim: str = Field(description="One factual statement. Numbers must come from the cited evidence.")
    evidence_ids: list[str] = Field(min_length=1, description="evidence_id values returned by tools")

class Report(BaseModel):
    summary: str
    findings: list[Finding] = []
    actions: list[str] = []
    knowledge_citations: list[str] = []
    cannot_determine: list[str] = Field(
        default=[], description="What the data cannot answer. Never invent numbers.")