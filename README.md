# Tailo

> Tailor your CV to any job description in seconds — powered by LLMs,
> without fabricating a single skill.

## What It Does

Tailo takes your master CV and a target job description, analyzes the
gap between them, and generates a tailored resume that honestly
highlights your most relevant experience.

- Reorders sections to put the most relevant experience first
- Reframes bullet points using the language of the job description
- Scores your match across technical skills, experience, and seniority
- Flags gaps honestly with actionable suggestions
- Exports the tailored CV as a one-page, ATS-friendly PDF
- Saves multiple master CVs and switches between them in one click
- Stores every version so you can track what you sent where
- Lets you configure the PDF contact header (name, email, phone, LinkedIn,
  website) from a settings page, independent of the master CV

## Tech Stack

- **Next.js 16** + TypeScript (App Router)
- **Vercel AI SDK** with Claude (`claude-sonnet-4-6` via Anthropic)
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
- [ ] User accounts and authentication: settings, master CVs, and history
  become per-user, so each signed-in user gets their own isolated workspace
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

npx prisma generate
npx prisma db push
npm run dev
```

Never commit `.env` or `.env.local`. They hold secrets and are git-ignored.

## License

MIT
