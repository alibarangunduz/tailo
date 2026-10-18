# Changelog

All notable changes to Tailo. Versions follow [SemVer](https://semver.org/) and
commit subjects follow [Conventional Commits](https://www.conventionalcommits.org/);
see "Commit messages and versioning" in AGENTS.md.

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
