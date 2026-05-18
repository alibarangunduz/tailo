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
- `unpdf` for extracting text from uploaded PDF CVs
- `@react-pdf/renderer` for generating the exported PDF
- Tailwind CSS
- Deployed on Vercel

## Architecture Decisions

- All LLM calls go through the Vercel AI SDK `streamText()`, never raw fetch to
  Anthropic. The model is `anthropic('claude-sonnet-4-5')`.
- `/api/tailor` streams the response with `toTextStreamResponse()` and persists the
  result to the database inside the `onFinish` callback.
- Database operations use the Prisma client from `src/lib/db.ts`.
- System prompts live in `src/lib/prompts.ts`, never inline in route handlers.
- PDF text extraction uses `unpdf` in `src/lib/pdf-parser.ts`.
- PDF export uses `@react-pdf/renderer` in `src/lib/cv-pdf.tsx`. It runs client-side
  and is dynamically imported (`await import('@/lib/cv-pdf')`) so it stays out of the
  SSR and initial bundle.
- No authentication for the MVP (single user).

## PDF Export

- The exported CV must stay one page and be ATS-readable: real selectable text,
  no tables, no text rendered as images.
- The layout mirrors the user's master CV template (`CV Template Tailo.docx`, kept
  local and git-ignored). Decoded design tokens: section headings `#3C78D8`, links
  `#1155CC`, US Letter, tight margins.
- Contact header values live in `src/lib/cv-header.ts` (single-user MVP constants).
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

- Never commit secrets. `.env` and `.env.local` (holding `ANTHROPIC_API_KEY` and
  `DATABASE_URL`) are git-ignored and must stay that way.
- `.claude/settings.local.json` and `CV Template Tailo.docx` are git-ignored.
- Never hardcode API keys or connection strings in source files.

## Common Pitfalls

- Vercel AI SDK: use `streamText`, not `generateText`, for the tailoring endpoint.
- Prisma: run `npx prisma generate` after schema changes.
- Neon: the connection string must include `?sslmode=require`.
- PDF parsing must handle both the text-paste and file-upload paths.
- `@react-pdf/renderer` must never be imported at module top level in a server or
  shared module; always dynamically import it on the client.
