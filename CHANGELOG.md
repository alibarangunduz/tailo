# Changelog

All notable changes to Tailo. Versions follow [SemVer](https://semver.org/) and
commit subjects follow [Conventional Commits](https://www.conventionalcommits.org/);
see "Commit messages and versioning" in AGENTS.md.

## [0.3.0] - 2026-10-19

### Removed

- **Find Jobs** (Adzuna job search, the `/jobs` page, `/api/jobs/search` and
  the Haiku ranking call). Tailo now focuses on tailoring only. The
  `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` environment variables are no longer used.
- The hardcoded default contact header and project link, which put the owner's
  contact details into every new user's settings and PDF.

### Changed

- **Breaking:** `/api/tailor` requires `masterCVId` and tailors the saved CV
  text from the database; the request body's CV text is ignored. The route no
  longer creates a master CV on its own. The tailor page saves new or edited
  CV text first ("Save CV and tailor").
- A new user's PDF header is seeded from their own account name and email.

### Fixed

- `/api/tailor` no longer writes model output (CV content) to the server log
  when saving a result fails.

### Added

- `LAUNCH_PLAN.md`: the full v1 launch plan.

## [0.2.0] - 2026-10-19

### Added

- Inline editor for the tailored CV (summary, skills, roles, bullets, projects,
  education); edits feed the PDF export and copied text.
- One-line role headers in the PDF, with a notice when a company name had to be
  shortened.
- Tailoring eval (`evals/tailor`): format, one-page and honesty checks plus a
  pairwise judge, for comparing models and prompts before shipping.
- Test suite (Vitest): unit, integration, component and offline eval tests;
  every API route is checked for a 401 when signed out.
- GitHub Actions CI: lint, typecheck and tests on pull requests and on `main`.

### Changed

- Tailoring model upgraded to Claude Sonnet 5.5 (medium effort), with a 16k
  output cap that covers its thinking.
- The tailoring call moved to `src/lib/tailor.ts`, shared by `/api/tailor` and
  the eval.

## [0.1.0] - 2026-05-31

### Added

- Core tailoring: master CV and job description to a tailored CV, match score
  and gap analysis, streamed from Claude.
- "Fill the gap" regenerate flow with supplemental details.
- One-page, ATS-friendly PDF export following the master CV template, named
  `name_cv_year_company`.
- Saved master CVs with switching, renaming and deletion; PDF upload with text
  extraction.
- Generation history.
- Settings page for the PDF contact header.
- Google sign-in (Auth.js) with per-user data isolation.
- Find Jobs: CV-ranked job search via Adzuna.
- Zod input guardrails, LLM output caps and per-user rate limiting.
