# Tailoring eval

Measures the `/api/tailor` flow (master CV + job description to tailored CV JSON
and the exported PDF), so a model or prompt change can be compared against a
frozen reference before it ships.

The runner calls `streamTailor()` from `src/lib/tailor.ts`, the same function the
route uses, and renders the real PDF with `fitCvPdf()` from `src/lib/cv-pdf.tsx`.
Nothing is written to the database.

## Inputs

`fixtures/` (git-ignored, contains personal CV data):

- `master-cv.txt`: the master CV every case is tailored from
- `cases.json`: 30 job descriptions from tailoring history, stratified by
  historical match score (strong, medium, weak) and role family, plus edge cases
  (`bug-report`, `short-jd`, `long-jd`)
- `cases.md`: the same set as a readable review file

## Grading

Programmatic checks, free and deterministic:

| metric | passes when |
|---|---|
| `checks_pass` | every check below passes (headline) |
| `valid_json` | the output parses and has every field the UI reads |
| `one_page` | the rendered PDF is one page |
| `budget` | summary at most 80 words, at most 5 skill categories, at most 14 bullets |
| `date_format` | experience date ranges use an en dash: `July 2026 – Present` |
| `edu_format` | one line per education entry, no more entries than the master CV, ranges with an en dash |
| `names_exact` | company, job title and degree names appear in the master CV as written |
| `skills_in_cv` | share of listed skills found in the master CV (0 to 1) |

Pairwise judge (`claude-opus-5-5`), variants only: each output is compared, in
random A/B order, against the frozen baseline output for the same case
(`baseline/ref/<id>`). `win` is 1, 0.5 (tie or both bad) or 0. `honest` is 1
when the judge finds no unsupported or altered facts. Baseline rows score the
neutral `win = 0.5` and are not judged.

`fit_scale` (perf column) is the auto-fit content scale of the PDF: 0.85 means
the CV was crammed to the minimum size, 1.18 means it was short enough to grow.

## Offline tier

`tests/eval/graders.test.ts` (part of `npm test`, free) pins down the graders
above on synthetic outputs and grades a known-good output through the real PDF
render. Run it first; the paid run below is for comparing models and prompts.

## Running

```bash
# frozen reference: Sonnet 4.6, current prompt (run once, never regenerate)
npm run eval:tailor -- --variant baseline --model claude-sonnet-4-6 --reps 2

# a change under test, judged against the reference
npm run eval:tailor -- --variant v1 --model claude-sonnet-5-5 --reps 2

# pilot a subset first
npm run eval:tailor -- --variant v1 --model claude-sonnet-5-5 --cases case_01,case_11
```

Runs resume: rerunning a variant only fills in missing (case, rep) pairs.
Failed attempts go to `errors.jsonl`, not into the scores.

The runner refuses to start when its code (`run-eval.mjs`, `tailor-eval.ts`,
`src/lib/tailor.ts`, `src/lib/cv-pdf.tsx`, `package-lock.json`) changed since it
was last approved. Review the change, then add `--approve-harness` once.

Build the report (the builder ships with the `/claude-api` skill):

```bash
node <claude-api skill dir>/shared/evals/report/build-report-lite.mjs .claude/hillclimb/tailor/
```

Output lives in `.claude/hillclimb/tailor/` (git-ignored): `<variant>/results.jsonl`,
`<variant>/traces/`, `<variant>/out/*.pdf` and `report.html`.
