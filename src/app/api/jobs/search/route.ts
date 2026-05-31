import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { jobRankSystemPrompt } from '@/lib/prompts';
import { prisma } from '@/lib/db';
import { validateJobSearchInput } from '@/lib/guardrails';
import { getCurrentUserId, unauthorized } from '@/lib/session';
import { rateLimitedResponse } from '@/lib/rate-limit';
import { adzunaProvider } from '@/lib/jobs/adzuna';
import { ProviderNotConfiguredError } from '@/lib/jobs/provider';
import { buildQuery, extractCvProfile, prefilter, ScoredJob } from '@/lib/jobs/rank';
import { JobListing, JobSearchResponse } from '@/lib/types';

// Throttle job searches per user (security hardening gap 7). Each search makes a
// few cheap HTTP calls plus exactly one small ranking call.
const RATE_LIMIT = { limit: 30, windowMs: 60_000 };

const RESULTS_PER_PAGE = 20; // listings requested per Adzuna page (per employer)
const SHORTLIST = 15; // listings handed to the one ranking call
const RETURN_COUNT = 10; // ranked listings returned to the client
const MAX_OUTPUT_TOKENS = 1_500; // caps the ranking call's output
const CACHE_TTL_MS = 5 * 60_000; // identical repeat searches skip Adzuna and the LLM

// Process-local cache: an identical (user, query, page) within the TTL is served
// without touching the provider or spending tokens.
const cache = new Map<string, { expiresAt: number; value: JobSearchResponse }>();

// Strips any stray code fences the model may add around its JSON.
function cleanJson(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

interface RankedEntry {
  id: string;
  matchScore: number;
  whyItFits: string;
}

// The single paid step: ranks the shortlist against the compact CV profile with a
// cheap model. Only short snippets are sent, never the full CV or full postings.
async function rankShortlist(profileText: string, shortlist: ScoredJob[]): Promise<Map<string, RankedEntry>> {
  const postings = shortlist
    .map(({ job }) => {
      const snippet = job.description.slice(0, 240);
      return `- id: ${job.id}\n  title: ${job.title}\n  company: ${job.company}\n  location: ${job.location || 'n/a'}\n  snippet: ${snippet}`;
    })
    .join('\n');

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5'),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    system: jobRankSystemPrompt,
    prompt: `## Candidate Profile\n${profileText}\n\n## Job Postings\n${postings}\n\nRank these postings for this candidate.`,
  });

  const map = new Map<string, RankedEntry>();
  try {
    const parsed = JSON.parse(cleanJson(text)) as { ranked?: RankedEntry[] };
    if (Array.isArray(parsed.ranked)) {
      // Insertion order is the model's ranked order; the caller reads keys() back
      // in that same order.
      for (const entry of parsed.ranked) {
        if (!entry || typeof entry.id !== 'string') continue;
        map.set(entry.id, {
          id: entry.id,
          matchScore: Math.max(0, Math.min(100, Math.round(Number(entry.matchScore) || 0))),
          whyItFits: typeof entry.whyItFits === 'string' ? entry.whyItFits : '',
        });
      }
    }
  } catch (err) {
    console.error('Failed to parse job ranking response:', err);
  }
  return map;
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const limited = rateLimitedResponse('jobs', userId, RATE_LIMIT);
  if (limited) return limited;

  const body = await req.json();
  const { masterCVId, companies, location, remote, keywords } = body ?? {};
  const page = Number.isInteger(body?.page) && body.page > 0 ? body.page : 1;

  // Guardrails: cap input before any provider call or token spend.
  const check = validateJobSearchInput({ companies, location, remote, keywords, page });
  if (!check.ok) return Response.json({ error: check.error }, { status: check.status });

  // A CV is required to rank against. It must be one this user owns; scoping the
  // lookup by userId means another user's CV id resolves to "not found".
  if (!masterCVId || typeof masterCVId !== 'string') {
    return Response.json({ error: 'Select or upload a master CV first.' }, { status: 400 });
  }
  const cv = await prisma.masterCV.findFirst({
    where: { id: masterCVId, userId },
    select: { content: true },
  });
  if (!cv) return Response.json({ error: 'Not found' }, { status: 404 });

  // Normalize the targeted employers: trim, drop blanks, de-duplicate.
  const cleanedCompanies = Array.isArray(companies)
    ? [...new Set((companies as string[]).map((c) => c.trim()).filter(Boolean))]
    : [];

  const cacheKey = JSON.stringify({
    userId,
    masterCVId,
    companies: [...cleanedCompanies].sort(),
    location: (location ?? '').trim().toLowerCase(),
    remote: Boolean(remote),
    keywords: (keywords ?? '').trim().toLowerCase(),
    page,
  });
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(cached.value);
  }

  const profile = extractCvProfile(cv.content);
  const query = buildQuery(
    profile,
    { companies: cleanedCompanies, location, remote, keywords, page },
    RESULTS_PER_PAGE,
  );

  let providerResult;
  try {
    providerResult = await adzunaProvider.search(query);
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    console.error('Job provider search failed:', err);
    return Response.json({ error: 'Job search is temporarily unavailable.' }, { status: 502 });
  }

  if (providerResult.jobs.length === 0) {
    const empty: JobSearchResponse = { jobs: [], nextPage: null };
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: empty });
    return Response.json(empty);
  }

  const shortlist = prefilter(
    providerResult.jobs,
    profile,
    { companies: cleanedCompanies, location },
    SHORTLIST,
  );

  const ranked = await rankShortlist(profile.profileText, shortlist);

  // Assemble in the model's ranked order; any shortlisted job the model omitted
  // falls to the end with a local-signal fallback so nothing silently disappears.
  const byId = new Map(shortlist.map((s) => [s.job.id, s]));
  const orderedIds = [...ranked.keys()].filter((id) => byId.has(id));
  for (const s of shortlist) {
    if (!ranked.has(s.job.id)) orderedIds.push(s.job.id);
  }

  const jobs: JobListing[] = orderedIds.slice(0, RETURN_COUNT).map((id) => {
    const { job, localScore } = byId.get(id)!;
    const rank = ranked.get(id);
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      salary: job.salary,
      summary: job.description,
      matchScore: rank ? rank.matchScore : Math.min(90, 40 + localScore),
      whyItFits: rank?.whyItFits || 'Matched on your CV keywords and filters.',
    };
  });

  const response: JobSearchResponse = {
    jobs,
    nextPage: providerResult.hasMore ? page + 1 : null,
  };
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: response });
  return Response.json(response);
}
