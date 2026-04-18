# score_job regression fixtures

Three pre-fetched job description HTML files covering the ATS shapes the
`score_job` endpoint most commonly ingests:

| File | ATS | Role shape |
|---|---|---|
| `greenhouse-staff-backend.html` | Greenhouse | Staff-level backend IC |
| `lever-senior-platform.html` | Lever | Senior platform IC |
| `ashby-principal-infra.html` | Ashby | Principal infra IC |

## Running the regression harness

The scaffolding tests (fixture loading + text-extraction sanity) always run:

```bash
npx vitest run tests/integration/score-regression.test.ts
```

The live scoring tests are gated behind two env vars — both must be set:

```bash
DAMILOLA_SCORE_API_KEY=<key> RUN_SCORE_REGRESSION=1 \
  npx vitest run tests/integration/score-regression.test.ts
```

Optional overrides:

- `SCORE_JOB_ENDPOINT` — target URL (defaults to production
  `https://damilola.tech/api/v1/score-job`).

The live tests assert:
1. Response schema: `total: number`, `breakdown: {...}`, `reasoning: string`.
2. `total` in `[0, 100]`.
3. Same input → scores within ±5 across two consecutive calls.

## Dependencies

- Requires PR #119 (score_job accepts a pre-fetched `content` field) to be
  deployed for the live suite to pass — the harness already wires up the
  pre-fetched HTML payload.
- The scaffolding suite has no external dependencies and should run in CI
  as part of the default vitest matrix.

## Fixture provenance

These HTML snippets are hand-crafted to mirror the DOM shape and keyword
density of real postings on each ATS platform. The company "ExampleCo" is
synthetic; no real job posting is reproduced. Refresh fixtures whenever the
target ATS significantly changes its markup.
