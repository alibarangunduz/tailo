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
- Stores every version so you can track what you sent where

## Tech Stack

- **Next.js** + TypeScript (App Router)
- **Vercel AI SDK** with Claude (Anthropic)
- **PostgreSQL** via Neon — generation history and master CV storage
- **Prisma** ORM
- Deployed on **Vercel**

## Why I Built This

Tailoring a CV manually takes 30-60 minutes per application. Most
people either send the same generic CV everywhere (low hit rate) or
spend hours rewriting (not scalable). Tailo automates the first pass
while keeping the human in control of the final version.

## Roadmap

- [x] Core tailoring: master CV + job description → tailored CV
- [x] Match scoring and gap analysis
- [x] Generation history
- [ ] Company culture intelligence
- [ ] Multi-version generation with different strategic angles
- [ ] Semantic matching for large CVs

## Local Development

```bash
git clone https://github.com/alibarangunduz/tailo.git
cd tailo
npm install
cp .env.example .env.local
# Add ANTHROPIC_API_KEY and DATABASE_URL
npx prisma generate
npx prisma db push
npm run dev
```

## License

MIT
