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
  Anthropic. The model is `anthropic('claude-sonnet-4-6')`.
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
- ⚠️ NOT yet done: rate limiting / per-user request throttling (security gap 7,
  the next task). An authenticated user can currently loop `/api/tailor`.

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
- See `CV_TAILOR_APP_PLAN.md` "Pre-Deployment Security Hardening" for the live
  gap checklist. Next up: rate limiting (gap 7).

## Git Workflow

- The user often pushes commits themselves, right after they are made. Treat any
  commit as potentially already on origin.
- Do not amend or rewrite a commit after creating it, and do not suggest amending
  it: once it is on origin, rewriting forces a branch divergence that has to be
  untangled with a force-push.
- Never force-push without explicit confirmation from the user.

## Common Pitfalls

- Vercel AI SDK: use `streamText`, not `generateText`, for the tailoring endpoint.
  The output-token option is `maxOutputTokens` (not `maxTokens`) in this version.
- Prisma: run `npx prisma generate` after schema changes. `generate` is local
  only; `db push` touches the live Neon DB — confirm with the user before pushing.
  Stop the dev server before `generate`/`push` (it locks the query-engine DLL on
  Windows → EPERM).
- Neon: the connection string must include `?sslmode=require`.
- PDF parsing must handle both the text-paste and file-upload paths.
- `@react-pdf/renderer` must never be imported at module top level in a server or
  shared module; always dynamically import it on the client.
- Next 16: the `middleware` file convention is renamed to `proxy` (see
  `node_modules/next/dist/docs`). Read the bundled docs before using framework
  conventions — they differ from older Next.
