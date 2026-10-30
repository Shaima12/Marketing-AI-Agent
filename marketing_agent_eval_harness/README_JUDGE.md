# Agent Evaluation (LLM-as-Judge)

This folder evaluates the marketing agent's final reports on **10 reference questions** using an LLM judge (Gemini).

## How it works

For each question, the judge receives:

- the question and its **checklist** of business requirements,
- the **gold answer** (the expected result),
- the agent's **final report**,
- the **SQL evidence** the agent actually retrieved.

The judge checks the report against the checklist and verifies each claim against the SQL data. A claim without supporting evidence does not count. Scoring is **binary** (pass or fail, no partial credit), and a judge error counts as a failure.

## Metrics

| Metric | What it measures | Result |
|---|---|---|
| **Check pass rate** | Share of checklist requirements the report satisfies, backed by evidence | **93.6%** (44/47) |
| **Analysis coverage** | Share of expected analysis elements present in the report | **92%** (46/50) |

**Check pass rate** = passed checks / total checks.
Example checks: "identifies the right products", "numbers match the data", "rule is explicit", "does not default to a deep discount".

**Analysis coverage** = covered dimensions / applicable dimensions.
Five dimensions are checked: the expected conclusion, the business rule, the reason, the caveats, and the method. A dimension counts only if the question expects it and the report explicitly contains it.

Global percentages are computed over all questions pooled together, not averaged per question.

## Usage

```bash
pip install -U google-genai
export GEMINI_API_KEY="your_key"      # PowerShell: $env:GEMINI_API_KEY="your_key"

python judge_question.py Q01 Q02      # judge selected questions (one JSON file each)
python judge_question.py all          # judge all questions
python aggregate_results.py           # compute the global metrics
```

Per-question results are saved in `judge_results/`, and the global report in `report_judge_eval.json`.

## Limitations

- The judge is an LLM and has not been validated against human labels, so results are estimates.
- The sample is small (10 questions).
