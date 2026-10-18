<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CV Tailor — Project Guide

## Project Context

Tailo is an AI-powered CV tailoring app. Users provide a master CV and a job
description; the app uses Claude via the Vercel AI SDK to analyze the gap and
generate a tailored CV, a match score, and a gap analysis. The tailored CV can
be exported as a one-page, ATS-friendly PDF.

## Tech Stack

- Next.js 16 (App Router), TypeScript, `src/` directory
- Vercel AI SDK with the Anthropic Claude provider
- Neon (serverless PostgreSQL) with Prisma ORM
- Auth.js (NextAuth v5) + `@auth/prisma-adapter`, Google OAuth, database sessions
- `zod` for input validation (the guardrails layer)
- `unpdf` for extracting text from uploaded PDF CVs
- `@react-pdf/renderer` for generating the exported PDF
- Tailwind CSS
- Deployed on Vercel

## Architecture Decisions

- All LLM calls go through the Vercel AI SDK `streamText()`, never raw fetch to
  Anthropic. The model is `anthropic('claude-sonnet-5-5')` (latest Sonnet). It always
  thinks and thinking counts against `maxOutputTokens`, so keep that cap generous.
- `/api/tailor` streams the response with `toTextStreamResponse()` and persists the
  result to the database inside the `onFinish` callback.
- Database operations use the Prisma client from `src/lib/db.ts`.
- System prompts live in `src/lib/prompts.ts`, never inline in route handlers.
- PDF text extraction uses `unpdf` in `src/lib/pdf-parser.ts`.
- PDF export uses `@react-pdf/renderer` in `src/lib/cv-pdf.tsx`. It runs client-side
  and is dynamically imported (`await import('@/lib/cv-pdf')`) so it stays out of the
  SSR and initial bundle.
- Auth is Auth.js (NextAuth v5): config in `src/auth.ts`, handler at
  `src/app/api/auth/[...nextauth]/route.ts`, client `SessionProvider` in
  `src/components/providers.tsx`. Google OAuth only; database session strategy;
  users stored in our Neon DB via the Prisma adapter.
- The app is multi-tenant: `Settings`, `MasterCV`, `TailoredCV` each have a
  required `userId`. `Settings` is one row per user, keyed by `userId`.

## Auth and Data Isolation (load-bearing — do not regress)

- Every data route MUST derive the user from `getCurrentUserId()` (in
  `src/lib/session.ts`), return `unauthorized()` (401) when absent, and scope
  EVERY query by that `userId`. A missed scope is a data leak.
- Id-addressed routes verify ownership and return `404` (not `403`) for another
  user's record, so existence is not leaked.
- Server pages/layouts gate with `requireUserIdOrRedirect(callbackUrl)`.
- These server-side checks are authoritative. Next 16 renamed `middleware` →
  `proxy` and warns NOT to rely on proxy alone for authz; we do auth in each
  route/page instead, so there is intentionally no `proxy.ts` auth gate.
- `UserNav` (`src/components/user-nav.tsx`) is UX only — never an auth boundary.

## Input Guardrails

- `src/lib/guardrails.ts` (Zod) is the single source of truth for accepted input:
  size/type caps in one `LIMITS` object plus a `looksAbusive` padding check.
  Enforced server-side on every write/generate route; `LIMITS` re-used on the
  client for `maxLength`. `/api/tailor` also sets `maxOutputTokens`.
- Rate limiting is in-memory per instance (`src/lib/rate-limit.ts`); a global
  Redis-backed limiter is still to do (LAUNCH_PLAN.md section 13).

## PDF Export

- The exported CV must stay one page and be ATS-readable: real selectable text,
  no tables, no text rendered as images.
- The layout mirrors the user's master CV template (`CV Template Tailo.docx`, kept
  local and git-ignored). Decoded design tokens: section headings `#3C78D8`, links
  `#1155CC`, US Letter, tight margins.
- The PDF contact header is per-user: stored in the `Settings` table, edited at
  `/settings`, fetched in `tailored-result.tsx` and passed into `generateCvPdf`.
  `src/lib/cv-header.ts` holds the `CVHeader` type and `defaultCvHeader` seed.
- Built-in `Helvetica` and `Times-Roman` are used as stand-ins for the template's
  Nunito and Spectral fonts. Registering the real fonts is a known follow-up.
- The system prompt enforces a one-page content budget so generated content fits.

## Code Style

- TypeScript strict mode.
- Prefer server components; use `'use client'` only when needed.
- API routes in `src/app/api/` use Next.js Route Handlers.
- Keep components small and focused.
- Tailwind CSS only — no CSS modules or styled-components.
- Do not use double dashes ("--") in comments or strings; use commas or colons.

## Testing

- Vitest (`vitest.config.mts`): `npm test` must stay green before a commit;
  CI (`.github/workflows/ci.yml`) runs lint, typecheck and tests.
- Tests live in `tests/` (`unit`, `integration`, `components`, `eval`). Mock only
  the boundaries: `@/auth` (`tests/helpers/auth-mock.ts`), `@/lib/db`
  (`tests/helpers/prisma-mock.ts`) and `@ai-sdk/anthropic` (fake models from
  `tests/helpers/mock-model.ts`). Real route handlers, `streamText` and PDF
  rendering should run.
- New data route: `api-auth-guard.test.ts` covers its 401 automatically. Also add
  a test that asserts its `where` clauses carry `userId` and that another user's
  id returns 404. Only add a route to `PUBLIC_ROUTES` deliberately.
- Test data is synthetic (`tests/fixtures/sample-cv.ts`). Never commit real CV
  data; the real eval fixtures stay git-ignored.
- Changing a prompt or the PDF layout: run `npm test` (offline graders and
  one-page check), then the paid `npm run eval:tailor` before shipping.

## File Conventions

- Components in `src/components/` with kebab-case filenames.
- Utility functions and shared logic in `src/lib/`.
- Shared types in `src/lib/types.ts`.
- Prisma schema in `prisma/schema.prisma`.

## Security

- Never commit secrets. `.env` and `.env.local` (holding `ANTHROPIC_API_KEY`,
  `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) are
  git-ignored and must stay that way.
- `.claude/settings.local.json` and `CV Template Tailo.docx` are git-ignored.
- Never hardcode API keys or connection strings in source files.
- `LAUNCH_PLAN.md` is the live plan for v1 (security, GDPR, payments, launch);
  `CV_TAILOR_APP_PLAN.md` is the build history.
- Never log personal data: no CV text, job descriptions or model output in logs
  or error reports; log ids, status codes and counts only.
- The repo is public: no real CV data, contact details or unfixed vulnerability
  details in committed files.

## Git Workflow

- The user often pushes commits themselves, right after they are made. Treat any
  commit as potentially already on origin.
- Do not amend or rewrite a commit after creating it, and do not suggest amending
  it: once it is on origin, rewriting forces a branch divergence that has to be
  untangled with a force-push.
- Never force-push without explicit confirmation from the user.

### Commit messages and versioning

- Commit subjects follow Conventional Commits: `type(scope): summary`, e.g.
  `feat(tailor): one-click tailoring from a job result`, `fix(pdf): keep long
  company names on one line`. Types: `feat`, `fix`, `perf`, `refactor`, `test`,
  `docs`, `ci`, `build`, `chore`. A breaking change adds `!` (`feat!:`) and a
  `BREAKING CHANGE:` footer.
- Every commit that changes app behavior bumps `version` in `package.json` (and
  `package-lock.json`) in the same commit, per SemVer. While below 1.0.0:
  `feat` bumps the minor (0.2.0 to 0.3.0); `fix` and `perf` bump the patch (0.2.0
  to 0.2.1); a breaking change bumps the minor. From 1.0.0: breaking is major,
  `feat` minor, `fix` patch. `test`, `docs`, `ci`, `build`, `chore` and
  `refactor` do not bump.
- Bump with `npm version <minor|patch> --no-git-tag-version` so both files stay
  in sync, and add the change under the new version in `CHANGELOG.md` (newest
  first, grouped as Added / Fixed / Changed).
- Tag released versions `vX.Y.Z` when a PR merges to `main`, not on feature
  branches.

## Common Pitfalls

- Vercel AI SDK: use `streamText`, not `generateText`, for the tailoring endpoint.
  The output-token option is `maxOutputTokens` (not `maxTokens`) in this version.
- Prisma: run `npx prisma generate` after schema changes. `generate` is local
  only; `db push` touches the live Neon DB — confirm with the user before pushing.
  Stop the dev server before `generate`/`push` (it locks the query-engine DLL on
  Windows → EPERM).
- Neon: the connection string must include `?sslmode=require`.
- PDF parsing must handle both the text-paste and file-upload paths.
- npm 10.9 crashes with `Cannot read properties of null (reading 'edgesOut')`
  when installing the Vitest toolchain; use `npx npm@11 install ...` instead.
- `@react-pdf/renderer` must never be imported at module top level in a server or
  shared module; always dynamically import it on the client.
- Next 16: the `middleware` file convention is renamed to `proxy` (see
  `node_modules/next/dist/docs`). Read the bundled docs before using framework
  conventions — they differ from older Next.
