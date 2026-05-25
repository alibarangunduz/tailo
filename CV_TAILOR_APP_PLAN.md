# CV Tailor — AI-Powered Resume Tailoring App

## Overview

An LLM-powered application that takes a user's master CV and a target job description, analyzes the gap between them, and generates a tailored resume that honestly highlights the most relevant experience without fabricating skills.

## Current Status

> **⏱️ Sync — last updated 2026-05-25 (resume here next session)**
>
> - **Branch:** `feature/auth` (Phase 6 committed). Earlier work is on
>   `feature/settings-page` (open PR: settings page + guardrails + security docs).
> - **Done:** settings page · Zod input guardrails + output cap · **Phase 6 auth**
>   (Google OAuth, per-user data isolation, all routes gated, verified by tests).
> - **Live DB already migrated** for auth (User/Account/Session + required
>   `userId`); existing data backfilled to the owner account.
> - **▶️ NEXT UP: rate limiting** (security gap 7) — an authenticated user can
>   still loop `/api/tailor` unbounded → token-cost abuse, the owner's main worry.
>   Plan: per-user + per-IP limits via Arcjet or Upstash Ratelimit. Then Phase 7
>   (credits/payments).
> - **Before public deploy:** set `AUTH_SECRET` + Google creds in Vercel env, add
>   the prod Google redirect URI, confirm `trustHost`/`AUTH_URL` on Vercel.
> - **Local env (`.env.local`, git-ignored):** `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
>   `AUTH_GOOGLE_SECRET` are set. Owner account: gunduzbaran175@gmail.com.

Phase 1 (MVP) is built and working: master CV upload/paste, saved master CVs
(save, switch, rename, delete), job description input, Claude-powered tailoring
with streaming, match scoring, gap analysis, generation history, and a one-page,
ATS-friendly PDF export. This document keeps the original plan for context; the
sections below are updated to match the shipped implementation.

Recently shipped on top of the MVP:

- **Fill the gap (honest regenerate):** each missing or partial gap in the gap
  analysis now has a note field. The user types real details they actually have
  but never added to the master CV, then regenerates. The supplied notes are
  passed as a trusted "Supplemental Experience" block, and the system prompt
  treats them as truthful so gaps are filled honestly, never fabricated. After a
  successful regenerate, the app offers to fold those details into the saved
  master CV so they persist. See Phase 4 below.
- **Named PDF export:** the downloaded PDF filename is `name_cv_year_company`
  (e.g. `ali_baran_gunduz_cv_2026_tesla.pdf`), accents transliterated.
- **Settings page:** a `/settings` page lets the user configure the PDF contact
  header (name, email, phone, LinkedIn, website). The values are stored in a
  `Settings` table and threaded into the PDF export and the download filename,
  so the export no longer depends on a hardcoded constant or on parsing the name
  out of the master CV. See "Settings and the contact header" below.

## Pre-Deployment Security Hardening

The app was built as a single-user MVP with **no authentication and no access
control**, so as written it is not safe to expose publicly. The list below is an
audit of the real gaps in the current code, ordered so they can be fixed one by
one. Severity: 🔴 critical (do not deploy without), 🟠 high, 🟡 medium.

Some fixes are independent of auth and should land first; the rest are closed by
Phases 6 (auth) and 7 (credits). Do them in this order:

### A. Independent of auth (DONE — shipped via the guardrails layer)

All four are now enforced by a single pre-LLM guardrails module,
`src/lib/guardrails.ts`, which is the source of truth for what the app accepts.
It is applied server-side (authoritative) on every write/generate route and
re-used on the client for input caps and friendly feedback. Limits live in one
`LIMITS` object: master CV 30k chars, job description 20k, short fields 200,
supplemental notes 20 items × 1k chars, uploads 5 MB.

1. 🟢 **Unbounded LLM input → unbounded token cost.** `POST /api/tailor` now calls
   `validateTailorInput()` before any token is spent, rejecting oversized payloads
   with `413` and malformed ones with `400`. Inputs also have client-side
   `maxLength` caps so the limit is visible while typing.
2. 🟢 **No output cap on the model.** `streamText` now passes
   `maxOutputTokens: 4000`, sized above a valid one-page JSON response.
3. 🟢 **Unvalidated file upload.** `POST /api/master-cv/upload` now calls
   `validateUpload()` (PDF type + 5 MB cap) before reading the buffer, then
   re-checks the extracted text length. The client pre-checks the file too.
4. 🟢 **Prompt-injection / payload-padding surface.** `looksAbusive()` rejects the
   cheap high-signal abuse cases (a character or short token repeated thousands of
   times to pad the prompt) before the LLM call. This is defense in depth; the
   length caps remain the primary control and the system prompt stays
   authoritative. Full semantic injection defense is out of scope by design.

### B. Authentication and isolation (DONE — Phase 6, see below)

Shipped via Auth.js (Google OAuth, database sessions, users in our Neon DB). The
authoritative checks live in `src/lib/session.ts` and run in every route/server
page, per Next 16 guidance (do not rely on proxy alone). Verified with raw
`curl`: unauthenticated → 401, a second user → 404 on another user's records.

5. 🟢 **Every API route is open.** All data routes now call `getCurrentUserId()`
   and return 401 without a session. Audited: every `route.ts` under `src/app/api`
   is gated except the Auth.js handler itself.
6. 🟢 **No data isolation / ownership checks.** Every query is scoped to
   `session.user.id`; id-addressed routes verify ownership and return `404` (not
   `403`) for other users. `Settings` is now one row per user, keyed by `userId`.
7. 🔴 **No rate limiting or concurrency limit. ← NEXT UP.** Still open. An
   *authenticated* user can loop `/api/tailor` without limit, so token cost is
   unbounded per user. This is the top remaining risk and directly matches the
   owner's cost-abuse concern.
   - Fix: per-user (and per-IP) rate limits + a concurrency cap. Candidates:
     Arcjet (TS-native, Next-friendly) or Upstash Ratelimit. Smaller than full
     credits and should land before any public exposure.
8. 🟢 **Upload DoS (found during Phase 6).** `/api/master-cv/upload` ran the PDF
   parser for anonymous callers; now gated behind a session.
9. 🟡 **CSRF posture for mutations.** Mitigated by Auth.js `SameSite=Lax` session
   cookies (browser-enforced). An explicit token would be belt-and-suspenders.

### C. Requires credits / payments (Phase 7)

10. 🔴 **Token spend is ungated.** Even with auth, an authenticated user can run
    `/api/tailor` without limit.
    - Fix: a pre-flight credit check that debits before the model call and rejects
      at zero balance (see Phase 7). Credits are the hard ceiling on spend.
11. 🟠 **Streaming-disconnect billing.** With `streamText`, a client disconnect can
    still incur generated-token cost while `onFinish` (which persists history) may
    not fire, so a naive "charge on finish" leaks free runs.
    - Fix: reserve credit on start, settle on finish, refund on hard failure.
12. 🟠 **Stripe webhook integrity.** When payments land, an unverified or
    non-idempotent webhook can be forged or replayed to grant free credits.
    - Fix: verify the Stripe signature and make crediting idempotent on the event id.

### D. Already in good shape (keep it that way)

- Secrets (`ANTHROPIC_API_KEY`, `DATABASE_URL`) are server-side and git-ignored;
  the LLM key never reaches the client. Keep all new secrets (`AUTH_SECRET`,
  Stripe keys + webhook secret) in Vercel env only.
- Neon encrypts data at rest. Note this does **not** substitute for app-level
  isolation (gap 6): an isolation bug leaks data regardless of disk encryption.
- If serving EU users, add a real account + data deletion path (GDPR) when auth
  lands: cascade-delete the user's CVs, history, and settings.

## Why This Exists

Applying to jobs requires tailoring your CV for each role. Doing this manually takes 30-60 minutes per application. This app automates the first pass: reordering sections, reframing bullet points, surfacing the most relevant experience, and scoring the match, all while respecting the truth of what the user has actually done.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Next.js 16 (App Router) | Framework, TypeScript |
| Vercel AI SDK | LLM streaming, structured output |
| Claude API (Anthropic) | `claude-sonnet-4-6` via Vercel AI SDK |
| Neon (PostgreSQL) | Database, serverless PostgreSQL |
| Prisma | ORM, schema management |
| unpdf | Text extraction from uploaded PDF CVs |
| @react-pdf/renderer | One-page PDF export of the tailored CV |
| Tailwind CSS | Styling |
| Vercel | Deployment |

## Environment Variables

```env
ANTHROPIC_API_KEY=
DATABASE_URL=          # Neon PostgreSQL connection string
```

---

## Phase 1 — This Weekend (MVP)

### Core User Flow

1. User uploads or pastes their master CV (PDF or text)
2. User pastes the target job description
3. App sends both to Claude with a structured system prompt
4. Claude analyzes the gap and generates:
   - A tailored CV (restructured, reframed, reordered)
   - A match score with breakdown
   - A gap analysis (what's missing, what's strong)
5. User views the result, copies the text, or exports a one-page PDF
6. Everything is stored in PostgreSQL for history

### Database Schema (Prisma)

```prisma
model MasterCV {
  id        String   @id @default(cuid())
  name      String
  content   String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tailoredVersions TailoredCV[]
}

model TailoredCV {
  id               String   @id @default(cuid())
  masterCVId       String
  masterCV         MasterCV @relation(fields: [masterCVId], references: [id])
  jobTitle         String
  company          String
  jobDescription   String   @db.Text
  tailoredContent  String   @db.Text
  matchScore       Int      // 0-100
  gapAnalysis      String   @db.Text
  strengthAnalysis String   @db.Text
  createdAt        DateTime @default(now())
}

// Contact header for the exported PDF. Single-user MVP: one row keyed by a
// fixed id ("singleton"), editable from the /settings page. Becomes per-user
// when authentication lands (see Phase 6).
model Settings {
  id        String   @id @default("singleton")
  name      String
  email     String
  phone     String
  linkedin  String
  website   String
  updatedAt DateTime @updatedAt
}
```

### Project Structure

```
tailo/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Landing / dashboard
│   │   ├── tailor/
│   │   │   └── page.tsx                # Main tailoring interface
│   │   ├── history/
│   │   │   └── page.tsx                # Past generations
│   │   ├── settings/
│   │   │   └── page.tsx                # Configure the PDF contact header
│   │   └── api/
│   │       ├── tailor/route.ts         # POST: generate tailored CV (streaming)
│   │       ├── master-cv/route.ts      # GET list, POST create, PUT update
│   │       ├── master-cv/[id]/route.ts # GET one, DELETE one (cascades tailored CVs)
│   │       ├── master-cv/upload/route.ts  # PDF text extraction (no persistence)
│   │       ├── settings/route.ts       # GET (seed + read), PUT (upsert) contact header
│   │       └── history/route.ts        # GET tailored versions
│   ├── components/
│   │   ├── cv-upload.tsx               # PDF upload + text paste
│   │   ├── job-description-input.tsx   # Job description paste area
│   │   ├── tailored-result.tsx         # Display CV, copy text, download PDF
│   │   ├── match-score.tsx             # Visual score breakdown
│   │   └── gap-analysis.tsx            # What's missing / strong
│   └── lib/
│       ├── db.ts                       # Prisma client
│       ├── prompts.ts                  # System prompt for Claude
│       ├── pdf-parser.ts               # PDF to text extraction (unpdf)
│       ├── cv-pdf.tsx                  # One-page PDF export (@react-pdf/renderer)
│       ├── cv-header.ts                # Contact header type + default seed values
│       └── types.ts                    # TypeScript types
├── prisma/
│   └── schema.prisma
├── .env.local                          # Secrets, git-ignored
├── AGENTS.md                           # Project guide (CLAUDE.md imports it)
├── README.md
└── package.json
```

### API Route: /api/tailor (Core Logic)

```typescript
// app/api/tailor/route.ts
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { systemPrompt } from '@/lib/prompts';

export async function POST(req: Request) {
  const { masterCV, jobDescription, company, jobTitle } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    prompt: `
## Master CV
${masterCV}

## Target Job Description
Company: ${company}
Role: ${jobTitle}

${jobDescription}

Analyze the gap between this CV and the job description. Then generate a tailored version.
    `,
  });

  return result.toTextStreamResponse();
}
```

The shipped route also persists each generation to the database inside the
`streamText` `onFinish` callback.

### System Prompt (lib/prompts.ts)

This is the most critical part of the app. The prompt should:

```typescript
export const systemPrompt = `You are an expert CV tailoring assistant. You receive a master CV and a target job description.

Your job is to generate a tailored CV that maximizes the candidate's chances of getting an interview, while staying completely honest about their experience.

## Rules

1. NEVER fabricate skills, experiences, or metrics the candidate doesn't have
2. NEVER add technologies or tools not mentioned in the master CV
3. You CAN reorder sections to put the most relevant experience first
4. You CAN reframe existing bullet points to use language that mirrors the job description
5. You CAN emphasize certain experiences over others based on relevance
6. You CAN adjust the summary to speak directly to what the role needs
7. You CAN compress less relevant roles to save space
8. You MUST keep it to one page worth of content
9. You SHOULD surface soft signals (location, language skills, certifications) if the job description values them

## Output Format

Respond with a JSON object containing these fields:

{
  "matchScore": <number 0-100>,
  "scoreBreakdown": {
    "technicalSkillsMatch": <number 0-100>,
    "experienceRelevance": <number 0-100>,
    "seniorityFit": <number 0-100>,
    "culturalSignals": <number 0-100>
  },
  "gaps": [
    { "requirement": "<what they want>", "status": "missing|partial|strong", "suggestion": "<what the candidate could do>" }
  ],
  "strengths": [
    { "requirement": "<what they want>", "candidateEvidence": "<what the CV shows>" }
  ],
  "tailoredCV": {
    "summary": "<rewritten summary>",
    "skills": [
      { "category": "<name>", "items": "<comma-separated skills>" }
    ],
    "experience": [
      {
        "title": "<job title>",
        "company": "<company>",
        "location": "<location>",
        "dates": "<date range>",
        "subsections": [
          {
            "heading": "<subsection name>",
            "bullets": ["<bullet 1>", "<bullet 2>"]
          }
        ]
      }
    ],
    "education": "<one-line education>",
    "projects": []
  },
  "strategyNotes": "<brief explanation of what was changed and why, like a cover letter to the candidate>"
}`;
```

The live prompt in `src/lib/prompts.ts` also includes an explicit one-page content
budget (limits on summary length, number of skill categories, and total experience
bullets) so the generated CV fits the one-page PDF export.

### PDF Parsing

```typescript
// src/lib/pdf-parser.ts
// Use unpdf to extract text from uploaded PDFs
import { extractText, getDocumentProxy } from 'unpdf';

export async function parsePDF(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
```

### PDF Export

The tailored CV is exported as a one-page, ATS-friendly PDF with
`@react-pdf/renderer` (`src/lib/cv-pdf.tsx`). The layout mirrors the user's
master CV template: a single-line header, blue section headings with rules,
centered underlined company names, and italic locations. Generation runs
client-side and is dynamically imported so `@react-pdf/renderer` stays out of
the SSR and initial bundle. The contact header values come from the `Settings`
record (see below), with `defaultCvHeader` in `src/lib/cv-header.ts` as the seed.

The download filename is built in `handleDownloadPdf` (`src/components/tailored-result.tsx`)
as `name_cv_year_company`, for example `ali_baran_gunduz_cv_2026_tesla.pdf`. The
name comes from the configured settings header (the name printed on the
document), the year is the current year, and the company is the one entered in
the job-description form. A `slugify` helper lowercases, NFD-normalizes to strip
accents (Gündüz to gunduz), and joins word runs with underscores. Blank parts
(e.g. an empty company) are dropped.

### Settings and the contact header

The PDF contact header is configured on the `/settings` page rather than parsed
from the master CV (the first line of a pasted CV is a single contact blob, so
the name cannot be extracted reliably). The values live in a single `Settings`
row keyed by a fixed id (`"singleton"`), exposed through `/api/settings`: `GET`
seeds the row from `defaultCvHeader` on first read and returns it, and `PUT`
upserts the edited values (name and email required). `tailored-result.tsx`
fetches the settings and passes them into `generateCvPdf(result, header)`, which
threads the header through the PDF document; each contact line renders only when
its field is set, so blank fields leave no dangling separators. `cv-header.ts`
keeps the `CVHeader` type, the `defaultCvHeader` seed, and the project-link map.

> **TODO (multi-user):** the `Settings` row is a single shared record today. When
> authentication lands (Phase 6), it gains a `userId` and becomes one settings
> record per user, so the PDF header and filename follow the signed-in user.

### Key UI Components

**Main Tailoring Page (app/tailor/page.tsx):**
- Left panel: Master CV upload/paste + Job description paste
- Right panel: Generated result (streams in)
- Bottom: Match score + gap analysis

**Result Display (src/components/tailored-result.tsx):**
- Formatted tailored CV
- Copy to clipboard button
- Download PDF button (one-page, ATS-friendly export)
- "Strategy Notes" expandable section explaining what was changed and why

### Weekend Timeline

**Saturday Morning:**
1. `npx create-next-app@latest cv-tailor --typescript --tailwind --app`
2. Set up Neon database, get connection string
3. Set up Prisma with schema
4. Build the /api/tailor route with Claude integration
5. Test with your actual master CV + the Tesla job description

**Saturday Afternoon:**
6. Build the UI: upload component, job description input, result display
7. Add streaming display for the tailored CV
8. Add match score visualization

**Sunday Morning:**
9. Add history page (list past generations from PostgreSQL)
10. Add PDF upload parsing
11. Polish UI

**Sunday Afternoon:**
12. Deploy to Vercel
13. Test end-to-end with 2-3 real job descriptions
14. Clean up README
15. Push final commits

---

## Phase 2 — Company Intelligence (Future)

- Scrape/analyze company career pages, Glassdoor reviews, LinkedIn patterns
- Build a company culture profile per company
- Store in PostgreSQL: company name, culture keywords, values, common job posting language
- Feed company context into the tailoring prompt
- Example: "Tesla values high-agency, shipping fast, end-to-end ownership" gets injected so the CV uses their language

## Phase 3 — Strategic Restructuring (Future)

- Detect section ordering that maximizes relevance
- Identify "big plus" vs "required" in job descriptions
- Match soft requirements (location, language, visa) to subtle posting signals
- Generate multiple CV versions with different strategies:
  - "Lead with AI experience" vs "Lead with full-stack experience"
  - User picks the best one

## Phase 4 — Gap Analysis + Action Plan (Partly shipped)

- [x] Confidence scoring per requirement: strong match, partial, gap
- [x] Fill the gap: user supplies real details for a missing/partial gap and
  regenerates, with the option to save those details back to the master CV
  (see Current Status). Honest by construction: the model only uses what the
  user actually provides.
- [ ] Actionable suggestions: "You're missing RAG experience, here's a weekend project"
- [ ] Track which gaps appear across multiple applications to prioritize learning

## Phase 5 — Multi-Version Generation (Future)

- Generate 2-3 versions with different strategic angles
- Side-by-side comparison view
- A/B tracking: which version style gets more callbacks
- pgvector integration when users have large master CVs with many years of experience

## Phase 6 — Accounts and Multi-Tenancy ✅ DONE

Shipped on branch `feature/auth`. Every record is now user-scoped; the app serves
multiple isolated workspaces. Closed security gaps 5, 6, 8.

**As built:** Auth.js (NextAuth v5) + `@auth/prisma-adapter`, Google OAuth only,
database session strategy, users stored in our Neon DB. Config in `src/auth.ts`;
handler at `src/app/api/auth/[...nextauth]/route.ts`; client `SessionProvider` in
`src/components/providers.tsx`. Authoritative checks in `src/lib/session.ts`
(`getCurrentUserId` + `unauthorized` for routes, `requireUserIdOrRedirect` for
server pages) — used in every data route and the `/tailor`, `/settings`,
`/history` gates. `UserNav` (`src/components/user-nav.tsx`) shows name + sign-out
on every page. Env: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` in
`.env.local` (local dev) — must also be set in Vercel for prod, with the prod
Google redirect URI registered.

**The schema/migration below is what was applied** (the live Neon DB was migrated
non-destructively: add nullable `userId` → backfill existing rows to the first
account → tighten to required). Kept for reference.

**Original estimate (for context):** ~2–3 focused days.

### Schema diff

```prisma
// New: Auth.js core model plus app data. Account / Session / VerificationToken
// come from the Auth.js Prisma adapter (add them per its docs).
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())

  accounts  Account[]      // Auth.js
  sessions  Session[]      // Auth.js
  masterCVs MasterCV[]
  tailored  TailoredCV[]
  settings  Settings?
}

model MasterCV {
  id        String   @id @default(cuid())
  userId    String                         // + new
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  content   String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tailoredVersions TailoredCV[]
  @@index([userId])                        // + new
}

model TailoredCV {
  id         String   @id @default(cuid())
  userId     String                        // + new (denormalized for direct filtering)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  masterCVId String
  masterCV   MasterCV @relation(fields: [masterCVId], references: [id])
  // ...existing fields unchanged...
  @@index([userId])                        // + new
}

// Settings: drop the fixed "singleton" id; one row per user instead.
model Settings {
  id        String   @id @default(cuid())  // changed: no longer "singleton"
  userId    String   @unique               // + new
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  email     String
  phone     String
  linkedin  String
  website   String
  updatedAt DateTime @updatedAt
}
```

### Tasks (in order)

1. Install and configure Auth.js (NextAuth v5) with the Prisma adapter and one
   provider (Google/GitHub OAuth or email magic link). Add `AUTH_SECRET` and any
   provider keys to Vercel env (and `.env.local` for dev).
2. Add the schema above; run `npx prisma generate` and `npx prisma db push`.
   Write a one-off backfill that assigns all existing rows to your own account and
   converts the singleton `Settings` row to a per-user row.
3. Add a session helper (`auth()` server-side) and a sign-in page. Add
   `middleware.ts` to gate `/tailor`, `/history`, and `/settings`.
4. Thread `userId` into every route and query — the load-bearing step:
   - `/api/tailor`: require a session; set `userId` on created `MasterCV` and
     `TailoredCV`.
   - `/api/master-cv` (list/create/update) and `/api/master-cv/[id]` (get/delete):
     filter and verify by `session.userId`; return `404` on another user's id.
   - `/api/history`: `where: { userId }`.
   - `/api/settings`: key the upsert on `userId`; on first read, seed from
     `defaultCvHeader` for that user (the existing seed logic, per user).
5. Update client fetches/components to assume an authenticated session; add a
   sign-out control and show the user's name in the nav.
6. Test isolation explicitly: signed in as user A, attempt to read/delete user B's
   CV and history by id — must 404. This is the acceptance test for the phase.

## Phase 7 — Credits and Payments

With the app multi-tenant, meter and monetize usage so a tailoring run costs
credits. Closes security gaps 9–11. **Estimated effort:** ~2–3 days incl. Stripe
webhooks and edge cases.

### Unit economics

A `claude-sonnet-4-6` run is roughly 3–6k input + 2–3k output tokens, on the order
of ~$0.04–0.07 per generation (verify against current Anthropic pricing). A
"fill the gap" regenerate costs about the same again. Price credit packs with
margin on top of that (e.g. 20 runs / $5, 100 / $20). Recommended go-to-market:
**freemium (a few free runs) + credit packs** — simplest to build, and credits
make token spend self-limiting.

### Schema diff

```prisma
// Append-only ledger: balance = sum(delta). Auditable and reconstructable.
model CreditLedger {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  delta     Int      // + purchase / refund, - debit per run
  reason    String   // "purchase" | "tailor_run" | "refund"
  ref       String?  // Stripe event id or TailoredCV id, for idempotency
  createdAt DateTime @default(now())

  @@unique([reason, ref])   // idempotency: a webhook/run can credit/debit once
  @@index([userId])
}
```

Optionally cache the balance as `User.credits Int @default(0)` for fast reads,
updated in the same transaction as each ledger entry (ledger remains the source
of truth). Seed new users with a small free balance.

### Tasks (in order)

1. Add the `CreditLedger` model (+ optional cached balance); generate and push.
2. Gate `/api/tailor`: before the model call, check balance > 0 (else `402`
   "out of credits"); **reserve** a credit at start, **settle** it on `onFinish`,
   and **refund** on hard failure (handles the streaming-disconnect gap 10).
3. Add Stripe Checkout for credit packs. On the `checkout.session.completed`
   webhook: verify the signature, then write a `purchase` ledger entry keyed on
   the Stripe event id so retries are idempotent (gap 11).
4. Surface the balance in the nav and settings; warn when low and link to the
   purchase flow.
5. Keep a dev escape hatch: treat credits as unlimited when auth/payments are not
   configured, so local development and the single-user path keep working.
6. Test: insufficient-balance rejection, a real debit per run, refund on failure,
   and replayed-webhook idempotency.

---

## CLAUDE.md (For Claude Code in VS Code)

> Note: the live project guide now lives in `AGENTS.md`, and `CLAUDE.md` imports it
> via `@AGENTS.md`. The block below is the original draft, kept for history.

Place this at the project root:

```markdown
# CLAUDE.md

## Project Context
CV Tailor is an AI-powered resume tailoring app. Users upload a master CV and paste a job description. The app uses Claude via the Vercel AI SDK to analyze the gap and generate a tailored CV.

## Tech Stack
- Next.js 14+ (App Router), TypeScript
- Vercel AI SDK with Anthropic Claude provider
- Neon (serverless PostgreSQL) with Prisma ORM
- Tailwind CSS
- Deployed on Vercel

## Architecture Decisions
- All LLM calls go through Vercel AI SDK streamText(), never raw fetch to Anthropic
- Database operations use Prisma client from lib/db.ts
- System prompts live in lib/prompts.ts, never inline in route handlers
- PDF parsing uses the unpdf package
- No authentication for MVP (single user)
- No pgvector for MVP (master CV fits in context window)

## Code Style
- Use TypeScript strict mode
- Prefer server components, use 'use client' only when needed
- API routes in app/api/ use Next.js Route Handlers
- Keep components small and focused
- Use Tailwind CSS, no CSS modules or styled-components
- Do not use double dashes ("--") in comments or strings, use commas or colons instead

## File Conventions
- Components in /components with kebab-case filenames
- Utility functions in /lib
- Types in /lib/types.ts
- Prisma schema in /prisma/schema.prisma

## Testing
- Test the /api/tailor route with real CV + job description data
- Verify streaming works correctly
- Check that match scores are reasonable (not always 90+)

## Common Pitfalls
- Vercel AI SDK: use streamText not generateText for the tailoring endpoint
- Prisma: run npx prisma generate after schema changes
- Neon: connection string must include ?sslmode=require
- PDF parsing: handle both text paste and file upload paths
```

---

## README.md Template

> Note: the live `README.md` exists at the project root and is the source of truth.
> The block below is the original draft.

```markdown
# CV Tailor

An AI-powered resume tailoring app that analyzes your master CV against a target job description and generates an honestly tailored version.

## What It Does

1. Upload your master CV (PDF or paste text)
2. Paste the target job description
3. Get a tailored CV that reorders, reframes, and highlights your most relevant experience
4. See a match score breakdown and gap analysis
5. Track your tailoring history across applications

## Tech Stack

- **Next.js** + TypeScript (App Router)
- **Vercel AI SDK** with Claude (Anthropic)
- **PostgreSQL** via Neon (serverless)
- **Prisma** ORM
- **Tailwind CSS**
- Deployed on **Vercel**

## Key Design Decisions

- **Honesty first:** The app never fabricates skills or experience. It reframes and reorders what you actually have.
- **Structured output:** Claude returns JSON with the tailored CV, match score, gap analysis, and strategy notes.
- **Streaming:** Tailored CVs stream in real-time via the Vercel AI SDK.
- **History tracking:** Every generation is stored in PostgreSQL so you can compare versions across applications.

## Getting Started

\`\`\`bash
git clone https://github.com/yourusername/cv-tailor.git
cd cv-tailor
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY and DATABASE_URL
npx prisma generate
npx prisma db push
npm run dev
\`\`\`

## Roadmap

- [x] Core tailoring (master CV + job description → tailored CV)
- [x] Match scoring and gap analysis
- [x] Generation history
- [x] Fill the gap: regenerate with user-supplied details for missing gaps
- [x] Named PDF export (name_cv_year_company)
- [x] Settings page for the configurable PDF contact header
- [ ] User accounts and authentication: per-user settings, master CVs, history
- [ ] Credits and payments: buy credits, spend them per tailoring run
- [ ] Company culture intelligence
- [ ] Strategic section reordering
- [ ] Multi-version generation with different strategies
- [ ] pgvector for large CV semantic matching

## License

MIT
```

---

## Quick Start Commands

```bash
# Create project
npx create-next-app@latest cv-tailor --typescript --tailwind --app --src-dir --import-alias "@/*"

# Install dependencies
cd tailo
npm install ai @ai-sdk/anthropic prisma @prisma/client unpdf @react-pdf/renderer

# Initialize Prisma
npx prisma init

# After setting DATABASE_URL in .env.local
npx prisma generate
npx prisma db push

# Run dev server
npm run dev
```
