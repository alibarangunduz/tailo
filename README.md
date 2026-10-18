# Tailo

> Tailor your CV to any job in seconds and stay 100 percent true to your master
> CV. Powered by Claude, without fabricating a single skill.

## What It Does

Tailo tailors your CV to the job you are applying for: it analyzes the gap
between your master CV and the job description, then highlights your most
relevant experience honestly. Nothing is invented: every fact in the tailored CV
comes from your master CV or from details you confirmed yourself.

- Reorders sections to put the most relevant experience first
- Reframes bullet points using the language of the job description
- Scores your match across technical skills, experience, and seniority
- Flags gaps honestly with actionable suggestions
- Lets you edit the tailored CV inline (summary, skills, roles, bullets,
  projects, education) before copying or exporting it
- Exports the tailored CV as a one-page, ATS-friendly PDF
- Saves multiple master CVs and switches between them in one click
- Stores every version so you can track what you sent where
- Lets you configure the PDF contact header (name, email, phone, LinkedIn,
  website) from a settings page, independent of the master CV
- Per-user accounts (Google sign-in) with fully isolated data

## Tech Stack

- **Next.js 16** + TypeScript (App Router)
- **Vercel AI SDK** with Claude — `claude-sonnet-5-5` for tailoring (medium
  effort), `claude-haiku-4-5` for the cheap job-ranking pass
- **Auth.js (NextAuth v5)** + `@auth/prisma-adapter` — Google OAuth, per-user data
- **Adzuna API** — real job listings for the Find Jobs feature (zero LLM tokens)
- **PostgreSQL** via Neon — generation history and master CV storage
- **Prisma** ORM
- **unpdf** — text extraction from uploaded PDF CVs
- **@react-pdf/renderer** — one-page PDF export
- **Tailwind CSS** — styling
- Deployed on **Vercel**

## PDF Export

The result view has a "Download PDF" button that produces a one-page CV
matching the master CV template: a single-line header with blue links,
blue section headings with rules, centered underlined company names, and
italic locations. It is generated client-side, so the output is real
selectable text that applicant tracking systems (ATS) parse cleanly,
never a rasterized image.

The layout lives in `src/lib/cv-pdf.tsx`. The contact header (name, email,
phone, LinkedIn, website) is configured on the **Settings** page (`/settings`)
and stored in the database, so the exported PDF uses values the user controls
rather than parsing them out of the master CV. `src/lib/cv-header.ts` holds the
type and the default values used to seed an empty settings record.

Each role header (title, company, location, dates) always stays on one line.
Widths are measured with the renderer's own font metrics: the company is
centered on the page when it fits, otherwise it sits between the title and the
dates, tightening the gaps and shrinking that row slightly if needed. Only when
it still does not fit is it cut at a word boundary, and the app then asks you
to shorten it in the editor and export again.

## Find Jobs

> **Frozen.** Tailo now focuses on tailoring only (see Roadmap). Find Jobs gets
> no new features and is slated for removal.

The **Find Jobs** page (`/jobs`) turns Tailo from a CV editor into a job-hunt
starting point. You pick a saved master CV, enter targeted companies (e.g. SAP,
N26) and a location (Berlin, remote Germany), optionally a sector keyword like
"fintech", and get a ranked list of real openings linked straight to the posting.

It is designed to be cheap on purpose: **searching for jobs spends zero LLM
tokens.** Listings come from the Adzuna API, the CV is distilled into a keyword
profile locally, and a local pre-filter narrows the results to a short shortlist.
Only that shortlist is sent to one small `claude-haiku-4-5` call to rank fit and
write a one-line "why it fits" per role — roughly half a cent per search, and
zero on a repeated search within five minutes (results are cached). Targeted
companies are matched with Adzuna's exact-phrase employer search, and a listing
with no usable direct link falls back to a flagged portal search instead.

The provider sits behind a small `JobProvider` interface
(`src/lib/jobs/provider.ts`), so the source can be swapped (Adzuna to a broader
aggregator) without touching the ranking or UI.

## Why I Built This

Tailoring a CV manually takes 30-60 minutes per application. Most
people either send the same generic CV everywhere (low hit rate) or
spend hours rewriting (not scalable). Tailo automates the first pass
while keeping the human in control of the final version.

## Roadmap

**Focus:** Tailo does one thing and does it best: tailor a CV to a job while
staying strictly true to the user's master CV. Honesty is the product. Job
search and other side features are out of scope. Users are in the EU (Germany
first), so data protection is a core requirement, not an add-on.

### Shipped

- [x] Core tailoring: master CV + job description → tailored CV
- [x] Match scoring and gap analysis
- [x] Generation history
- [x] One-page, ATS-friendly PDF export
- [x] Saved master CVs with quick switching, renaming, and deletion
- [x] Settings page for the configurable PDF contact header
- [x] User accounts and authentication: settings, master CVs, and history are
  per-user, so each signed-in user gets their own isolated workspace
- [x] Tailoring model upgraded to Claude Sonnet 5.5: in a pilot comparison it
  stayed truer to the master CV than Sonnet 4.6 and ran about 2.5x faster at
  similar cost
- [x] Inline editor for the tailored CV; edits feed the PDF export and copy text
- [x] One-line role headers in the PDF, with a notice when a company name had
  to be shortened
- [x] Test suite and CI: unit, integration and offline eval tests on every PR
- [~] Per-user rate limiting (in-memory limiter shipped; production-grade
  Redis/Upstash backing still to do)
- [~] Tailoring eval (`evals/tailor`): format, one-page and honesty checks plus a
  pairwise judge, for comparing models and prompts before shipping; full
  baseline run still to do

### v1 launch (in priority order)

The detailed plan for launching Tailo as a company across the EU, with every
task, design and open decision, is in [LAUNCH_PLAN.md](LAUNCH_PLAN.md). In short:

1. **Scope cleanup:** remove Find Jobs, the hardcoded personal header and the
   hidden master CV creation
2. **Company and legal:** entity, tax, Impressum, privacy policy, terms,
   withdrawal rules for digital services, EU AI Act boundaries
3. **EU data protection (GDPR):** data inventory, DPAs with every processor, EU
   regions (Vercel functions in Frankfurt), no personal data in logs, retention,
   data minimization in prompts
4. **Input checks before any token is spent:** confirm extracted CV text, is it a
   CV, is it a job description, language detection; a failed check costs nothing
5. **Prompt injection defense:** normalization, pattern rules, hardened prompt
   structure, and output grounding checks reused from the eval
6. **Payments and credits:** VAT-handling provider, append-only ledger, atomic
   spend, refunds on failure, webhook idempotency, free-allowance abuse limits
7. **Run lifecycle and edge cases:** idempotent runs that survive disconnects,
   retries, timeouts and parallel requests
8. **Delete my account and export my data,** in one click each
9. **Smarter token usage without lowering quality:** prompt caching of the
   system prompt and master CV, identical-request reuse, measured with the eval
10. **Security and operations:** global rate limiting, security headers,
    migrations, tested backups, monitoring, spend caps, incident runbook
11. **Landing page:** demo video, pricing, FAQ, legal footer, then a private beta

### After launch

- [ ] CV variants: two pages and a detailed version (academia, research,
  medicine, senior management); templates for professions beyond software
- [ ] Locales: German UI first, regional CV formats (Lebenslauf, UK CV, US
  resume), A4 and local date formats per region
- [ ] Prompt formatting rules: en dash date ranges, one line per education
  entry, a single Certifications line, names exactly as in the master CV
- [ ] Embed the exact template fonts (Nunito, Spectral), which also fixes
  non-Latin characters
- [ ] Email magic link sign-in next to Google
- [ ] Cover letter from the same verified facts
- [ ] Structured education and projects in the data model
- [ ] Multi-version generation with different strategic angles

### Out of scope

- Find Jobs (Adzuna search): being removed
- Company culture intelligence and semantic job matching
- Selling to employers or recruiters to screen candidates (high-risk under the
  EU AI Act)

## Local Development

```bash
git clone https://github.com/alibarangunduz/tailo.git
cd tailo
npm install

# Create .env.local with your own credentials (it is git-ignored)
#   ANTHROPIC_API_KEY=your-anthropic-key
#   DATABASE_URL=your-neon-connection-string   (must include ?sslmode=require)
#   AUTH_SECRET=your-auth-secret
#   AUTH_GOOGLE_ID=your-google-oauth-client-id
#   AUTH_GOOGLE_SECRET=your-google-oauth-client-secret
#   ADZUNA_APP_ID=your-adzuna-app-id           (free at developer.adzuna.com)
#   ADZUNA_APP_KEY=your-adzuna-app-key          (Find Jobs is disabled without it)

npx prisma generate
npx prisma db push
npm run dev
```

Never commit `.env` or `.env.local`. They hold secrets and are git-ignored.

## Testing

```bash
npm test             # unit, integration and offline eval tests (Vitest)
npm run test:watch   # same, re-running on change
npm run typecheck
npm run lint
```

No test needs secrets, a database or network access. Auth, Prisma, Adzuna and
the Claude models are mocked at the module boundary, while the real route
handlers, guardrails, rate limiter, AI SDK streaming and PDF rendering run.
GitHub Actions runs lint, typecheck and tests on every push to `main` and on
every pull request.

| Layer | Where | Covers |
|---|---|---|
| Unit | `tests/unit` | guardrails, rate limiter, prompt building, job ranking, Adzuna mapping, session helpers |
| Integration | `tests/integration` | every API route; per-user scoping and 404 for other users' records; `/api/tailor` streaming and saving; PDF export (one page, selectable text) and upload round trip |
| Component | `tests/components` | the inline CV editor |
| Eval (offline) | `tests/eval` | the tailoring eval's graders, plus a known-good output graded through the real PDF render |

`tests/integration/api-auth-guard.test.ts` finds every route under `src/app/api`
automatically and checks that it returns 401 when signed out, without touching
the database. A new route that skips the session check fails CI.

The paid, model-in-the-loop eval stays manual: see
[`evals/tailor/README.md`](evals/tailor/README.md).

## License

MIT
