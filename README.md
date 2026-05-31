# Tailo

> Find the jobs that fit you, then tailor your CV to each one in seconds —
> powered by LLMs, without fabricating a single skill.

## What It Does

Tailo closes the loop on a job hunt: it **finds** roles that match your master
CV and links you straight to them, then **tailors** your CV to whichever one you
apply for, analyzing the gap and honestly highlighting your most relevant
experience.

- **Find Jobs:** enter targeted companies and a location (e.g. onsite Berlin,
  remote Germany) and get real listings ranked against your master CV, each with
  a direct link to apply
- Reorders sections to put the most relevant experience first
- Reframes bullet points using the language of the job description
- Scores your match across technical skills, experience, and seniority
- Flags gaps honestly with actionable suggestions
- Exports the tailored CV as a one-page, ATS-friendly PDF
- Saves multiple master CVs and switches between them in one click
- Stores every version so you can track what you sent where
- Lets you configure the PDF contact header (name, email, phone, LinkedIn,
  website) from a settings page, independent of the master CV
- Per-user accounts (Google sign-in) with fully isolated data

## Tech Stack

- **Next.js 16** + TypeScript (App Router)
- **Vercel AI SDK** with Claude — `claude-sonnet-4-6` for tailoring,
  `claude-haiku-4-5` for the cheap job-ranking pass
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

## Find Jobs

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

- [x] Core tailoring: master CV + job description → tailored CV
- [x] Match scoring and gap analysis
- [x] Generation history
- [x] One-page, ATS-friendly PDF export
- [x] Saved master CVs with quick switching, renaming, and deletion
- [x] Settings page for the configurable PDF contact header
- [x] User accounts and authentication: settings, master CVs, and history are
  per-user, so each signed-in user gets their own isolated workspace
- [x] Find Jobs: CV-ranked job search via Adzuna, token-light by design
- [~] Per-user rate limiting (in-memory limiter shipped; production-grade
  Redis/Upstash backing still to do)
- [ ] Save and track jobs found in search (currently results are live only)
- [ ] One-click: tailor a CV directly from a Find Jobs result
- [ ] Credits and payments: users buy credits and spend them per tailoring run
- [ ] Embed the exact template fonts (Nunito, Spectral)
- [ ] Structured education and projects in the data model
- [ ] Company culture intelligence
- [ ] Multi-version generation with different strategic angles
- [ ] Semantic matching for large CVs

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

## License

MIT
