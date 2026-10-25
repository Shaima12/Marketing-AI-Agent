from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator


class Dependency(BaseModel):
    step_id: str
    output_key: str
    optional: bool = False

class PlanStep(BaseModel):
    id: str
    objective: str
    purpose: str
    tool_candidates: list[str] = Field(default_factory=list)
    inputs: dict[str, Any] = Field(default_factory=dict)
    depends_on: list[Dependency] = Field(default_factory=list)
    output_key: str
    guide_ids: list[str] = Field(default_factory=list)
    status: Literal[
        "pending", "running", "completed", "blocked", "skipped", "failed"
    ] = "pending"
    optional: bool = False
    skip_if_data_unavailable: bool = False
    auto_complete_on_success: bool = Field(
        default=False,
        description=(
            "Set true ONLY for a simple lookup step that a single successful "
            "tool call fully answers (for example reading a promotions table). "
            "The step then completes without an extra model call. Leave false "
            "for analytical steps that may need follow-up queries."
        ),
    )


class ExecutionLimits(BaseModel):
    max_plan_steps: int = Field(default=6, ge=1, le=10)
    max_tool_calls: int = Field(default=10, ge=1, le=50)
    max_sql_calls: int = Field(default=4, ge=0, le=20)
    max_replans: int = Field(default=1, ge=0, le=3)
    max_llm_calls: int = Field(default=16, ge=1, le=20)


class InvestigationPlan(BaseModel):
    plan_version: str = "1.0"
    objective: str
    success_criteria: list[str] = Field(min_length=1, max_length=8)
    execution_limits: ExecutionLimits = Field(default_factory=ExecutionLimits)
    steps: list[PlanStep] = Field(min_length=1, max_length=6)

    @model_validator(mode="after")
    def validate_plan(self):
        if len(self.steps) > self.execution_limits.max_plan_steps:
            raise ValueError(
                f"Plan has {len(self.steps)} steps but limit is "
                f"{self.execution_limits.max_plan_steps}"
            )

        ids = [step.id for step in self.steps]
        outputs = [step.output_key for step in self.steps]
        if len(ids) != len(set(ids)):
            raise ValueError("Step IDs must be unique")
        if len(outputs) != len(set(outputs)):
            raise ValueError("Step output_key values must be unique")

        by_id = {step.id: step for step in self.steps}
        for step in self.steps:
            for dep in step.depends_on:
                if dep.step_id not in by_id:
                    raise ValueError(f"Unknown dependency step: {dep.step_id}")
                if dep.step_id == step.id:
                    raise ValueError(f"{step.id} cannot depend on itself")
                producer = by_id[dep.step_id]
                if producer.output_key != dep.output_key:
                    raise ValueError(
                        f"Dependency output mismatch: {dep.step_id} does not "
                        f"produce {dep.output_key}"
                    )

        # Cycle detection (Kahn's algorithm).
        indegree = {step.id: 0 for step in self.steps}
        children = {step.id: [] for step in self.steps}
        for step in self.steps:
            for dep in step.depends_on:
                indegree[step.id] += 1
                children[dep.step_id].append(step.id)

        queue = [sid for sid, degree in indegree.items() if degree == 0]
        visited = 0
        while queue:
            sid = queue.pop()
            visited += 1
            for child in children[sid]:
                indegree[child] -= 1
                if indegree[child] == 0:
                    queue.append(child)

        if visited != len(self.steps):
            raise ValueError("Plan contains a dependency cycle")

        return self
