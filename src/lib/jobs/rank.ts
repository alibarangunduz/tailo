// Local, LLM-free ranking helpers. Everything here runs in-process and costs zero
// tokens: we derive a compact keyword profile from the CV, build the provider
// query, and pre-score raw listings so only a small, relevant shortlist is handed
// to the one paid ranking call in the route.

import { JobQuery, RawJob } from './provider';

// Words too common to carry signal when matching a CV against a job description.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'was', 'were', 'has', 'have', 'had',
  'this', 'that', 'these', 'those', 'from', 'into', 'will', 'shall', 'can', 'all', 'any', 'but',
  'not', 'who', 'how', 'why', 'what', 'when', 'where', 'their', 'them', 'they', 'his', 'her',
  'its', 'out', 'about', 'over', 'under', 'than', 'then', 'such', 'also', 'more', 'most', 'some',
  'work', 'working', 'experience', 'team', 'role', 'job', 'company', 'years', 'year', 'skills',
  'responsibilities', 'requirements', 'including', 'using', 'use', 'within', 'across', 'strong',
]);

// A compact, provider-safe view of the candidate. `keywords` drives local scoring;
// `profileText` is the small blob sent to the ranking model (never the full CV).
export interface CvProfile {
  keywords: string[];
  profileText: string;
}

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9+#./ ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

// Derives the candidate profile from raw CV text by word frequency. No LLM call:
// this keeps the per-search token cost to the single ranking pass in the route,
// and it is bounded regardless of how large the CV is.
export function extractCvProfile(cvText: string): CvProfile {
  const counts = new Map<string, number>();
  for (const word of tokenize(cvText)) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const keywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([word]) => word);

  const profileText = `Candidate's strongest CV keywords (by frequency): ${keywords.join(', ')}.`;
  return { keywords, profileText };
}

// Builds the provider query. The `what` terms stay deliberately short, since
// Adzuna ANDs them and returns little when over-stuffed: the user's keywords lead,
// falling back to the top CV skills ONLY for a broad (no-company) search. When
// companies are targeted the provider filters by employer phrase instead, so
// keywords are left out there and the local CV ranking handles relevance.
export function buildQuery(
  profile: CvProfile,
  opts: { companies: string[]; location?: string; remote?: boolean; keywords?: string; page: number },
  resultsPerPage: number,
): JobQuery {
  // Commas are how users separate keywords ("fintech, backend"); Adzuna wants
  // them space separated.
  const userTerms = (opts.keywords ?? '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const hasCompanies = opts.companies.length > 0;
  const keywords = userTerms || (hasCompanies ? '' : profile.keywords.slice(0, 5).join(' '));
  return {
    keywords,
    location: opts.location?.trim() || undefined,
    remote: opts.remote ?? false,
    companies: opts.companies,
    page: opts.page,
    resultsPerPage,
  };
}

// A raw job plus the local relevance score used to pick the shortlist.
export interface ScoredJob {
  job: RawJob;
  localScore: number;
}

// Pre-scores listings with cheap signals: exact-targeted-employer match dominates,
// then location match, then CV keyword overlap in the title and snippet. Returns
// the top `limit` so the paid ranking call only ever sees a small shortlist.
export function prefilter(
  jobs: RawJob[],
  profile: CvProfile,
  opts: { companies: string[]; location?: string },
  limit: number,
): ScoredJob[] {
  const targetCompanies = opts.companies.map((c) => c.toLowerCase());
  const locationTerm = opts.location?.trim().toLowerCase() || '';
  const keywordSet = new Set(profile.keywords);

  const scored = jobs.map((job): ScoredJob => {
    let score = 0;

    const companyLower = job.company.toLowerCase();
    if (targetCompanies.some((c) => companyLower.includes(c) || c.includes(companyLower))) {
      score += 50;
    }
    if (locationTerm && job.location.toLowerCase().includes(locationTerm)) {
      score += 15;
    }

    const haystack = new Set(tokenize(`${job.title} ${job.description}`));
    let overlap = 0;
    for (const word of haystack) {
      if (keywordSet.has(word)) overlap += 1;
    }
    score += overlap;
    // Title hits count double: matching the role name is stronger signal than a
    // passing mention buried in the description.
    const titleHits = tokenize(job.title).filter((w) => keywordSet.has(w)).length;
    score += titleHits;

    return { job, localScore: score };
  });

  return scored.sort((a, b) => b.localScore - a.localScore).slice(0, limit);
}
