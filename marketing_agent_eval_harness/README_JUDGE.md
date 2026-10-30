# Final report evaluator — two metrics, binary scoring

The evaluator runs **all questions** in `questions.json` by default and judges the final answer using the corresponding gold answer and captured evidence in `results.json`.

## The only two aggregate metrics

1. **Analysis coverage (%)**: combined coverage of `expected_story`, `rule`, `reason`, `note`, and `method`. The judge first decides whether each dimension is applicable to that question. Each applicable dimension is binary: covered = 1; missing or unsupported = 0. Not-applicable dimensions are excluded from the denominator.
2. **Check pass rate (%)**: passed checklist items / all checklist items. Each original checklist item is binary: pass = 1; anything else = 0. There is no partial credit. If the judge call fails, that question's checks are conservatively scored 0 and the error is recorded.

The JSON also keeps per-question binary details and short reasons so results can be audited. It does not introduce additional aggregate scoring metrics.

## Run all questions

Place these three input files beside the script:
- `questions.json`
- `gold_answers.json`
- `results.json`

Then run:

```powershell
pip install -r requirements-judge.txt
$env:OPENAI_API_KEY = "YOUR_API_KEY"
python evaluate_report_with_judge.py
```

Defaults are already configured for all three filenames, all questions, and output `report_judge_eval.json`. No `--qids` argument is needed. Optional file/model overrides:

```powershell
python evaluate_report_with_judge.py --questions questions.json --gold gold_answers.json --results results.json --model gpt-4.1-mini --out report_judge_eval.json
```

## Notes

- The judge evaluates the claims/findings, report, summary, conclusion (if present), actions, notes and evidence together.
- Evidence IDs alone do not prove claims; the judge receives captured evidence rows.
- Exact numeric values and customer-ID set checks should additionally be validated deterministically where possible.
- LLM judging is probabilistic. Review a sample manually before using these scores as a release gate.
