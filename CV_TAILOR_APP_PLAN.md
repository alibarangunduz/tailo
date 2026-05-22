# CV Tailor — AI-Powered Resume Tailoring App

## Overview

An LLM-powered application that takes a user's master CV and a target job description, analyzes the gap between them, and generates a tailored resume that honestly highlights the most relevant experience without fabricating skills.

## Current Status

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

## Why This Exists

Applying to jobs requires tailoring your CV for each role. Doing this manually takes 30-60 minutes per application. This app automates the first pass: reordering sections, reframing bullet points, surfacing the most relevant experience, and scoring the match, all while respecting the truth of what the user has actually done.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| Next.js 16 (App Router) | Framework, TypeScript |
| Vercel AI SDK | LLM streaming, structured output |
| Claude API (Anthropic) | `claude-sonnet-4-5` via Vercel AI SDK |
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
│   │   └── api/
│   │       ├── tailor/route.ts         # POST: generate tailored CV (streaming)
│   │       ├── master-cv/route.ts      # GET list, POST create, PUT update
│   │       ├── master-cv/[id]/route.ts # GET one, DELETE one (cascades tailored CVs)
│   │       ├── master-cv/upload/route.ts  # PDF text extraction (no persistence)
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
│       ├── cv-header.ts                # Contact header constants for the PDF
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
    model: anthropic('claude-sonnet-4-5'),
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
the SSR and initial bundle. Contact header values live in `src/lib/cv-header.ts`.

The download filename is built in `handleDownloadPdf` (`src/components/tailored-result.tsx`)
as `name_cv_year_company`, for example `ali_baran_gunduz_cv_2026_tesla.pdf`. The
name comes from `cvHeader.name` (the name printed on the document), the year is
the current year, and the company is the one entered in the job-description form.
A `slugify` helper lowercases, NFD-normalizes to strip accents (Gündüz to gunduz),
and joins word runs with underscores. Blank parts (e.g. an empty company) are
dropped.

> **TODO (multi-user):** the filename name is currently fixed to the
> `cvHeader.name` constant, so every export uses the same person's name. When
> moving beyond the single-user MVP, add a real name field (an input on the
> master CV, or a `name` column on the saved CV) and source the filename name
> from the loaded CV instead of the constant. Parsing the name out of the pasted
> CV text is not reliable: the first line is a single contact blob.

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
- [ ] Per-CV name field so the PDF filename follows the loaded CV (multi-user)
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
