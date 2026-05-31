// Adzuna implementation of the JobProvider contract. Retrieval only, no LLM and
// zero tokens: this sends the built query terms (keywords, location, employer) to
// Adzuna and maps the response into RawJob. The candidate's CV is never sent here.
//
// Adzuna search docs: https://developer.adzuna.com/docs/search
// We target the German market ("de"); the de endpoint reports salaries in EUR.

import {
  JobProvider,
  JobProviderResult,
  JobQuery,
  ProviderNotConfiguredError,
  RawJob,
} from './provider';

const COUNTRY = 'de';
const BASE = `https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search`;

// Groups an integer with comma thousands separators, locale independent (Node's
// toLocaleString would otherwise follow the host locale).
const groupThousands = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// Builds a EUR salary display string, or null when there is no real figure.
// Predicted salaries (salary_is_predicted === "1") are dropped to avoid showing
// a guess as if it were posted.
function formatSalary(job: AdzunaJob): string | null {
  if (job.salary_is_predicted === '1') return null;
  const min = typeof job.salary_min === 'number' ? job.salary_min : null;
  const max = typeof job.salary_max === 'number' ? job.salary_max : null;
  if (min && max && min !== max) return `€${groupThousands(min)} - €${groupThousands(max)}`;
  const one = min ?? max;
  return one ? `€${groupThousands(one)}` : null;
}

// Shape of the fields we read from an Adzuna result. Adzuna returns more; we map
// only what the UI and ranking need.
interface AdzunaJob {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
}

interface AdzunaResponse {
  results?: AdzunaJob[];
}

function mapJob(job: AdzunaJob): RawJob {
  return {
    id: String(job.id ?? job.redirect_url ?? crypto.randomUUID()),
    title: job.title?.trim() || 'Untitled role',
    company: job.company?.display_name?.trim() || 'Unknown company',
    location: job.location?.display_name?.trim() || '',
    url: job.redirect_url?.trim() || null,
    salary: formatSalary(job),
    // Adzuna descriptions are short plain-text snippets; trim defensively.
    description: (job.description ?? '').trim(),
  };
}

// Assembles one Adzuna request URL. Adzuna has no employer-filter parameter, so a
// targeted company is matched as an exact phrase via `what_phrase`, which reliably
// returns that employer's postings. Keywords are not ANDed onto a company request:
// Adzuna treats multiple `what` terms as AND, which easily yields zero results
// (e.g. "SAP fintech"); for company searches we let the local CV ranking decide
// relevance instead. Remote intent broadens the location countrywide and, for
// broad searches, adds "remote" to the keywords.
function buildUrl(
  query: JobQuery,
  appId: string,
  appKey: string,
  company: string | undefined,
): string {
  const params = new URLSearchParams();
  params.set('app_id', appId);
  params.set('app_key', appKey);
  params.set('results_per_page', String(query.resultsPerPage));
  params.set('content-type', 'application/json');

  if (company) {
    params.set('what_phrase', company);
  } else {
    const what = [query.keywords, query.remote ? 'remote' : ''].filter(Boolean).join(' ').trim();
    if (what) params.set('what', what);
  }

  const where = query.location?.trim() || (query.remote ? 'Germany' : '');
  if (where) params.set('where', where);

  // Page is the last path segment and must be at least 1.
  const page = Math.max(1, query.page);
  return `${BASE}/${page}?${params.toString()}`;
}

async function fetchOne(url: string, perPage: number): Promise<{ jobs: RawJob[]; full: boolean }> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    // A failed employer query should not sink the whole search; treat it as empty.
    console.error('Adzuna request failed:', res.status, await res.text().catch(() => ''));
    return { jobs: [], full: false };
  }
  const data = (await res.json()) as AdzunaResponse;
  const results = Array.isArray(data.results) ? data.results : [];
  return { jobs: results.map(mapJob), full: results.length >= perPage };
}

export const adzunaProvider: JobProvider = {
  async search(query: JobQuery): Promise<JobProviderResult> {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) {
      throw new ProviderNotConfiguredError(
        'Job search is not configured: set ADZUNA_APP_ID and ADZUNA_APP_KEY in the environment.',
      );
    }

    // One request per targeted employer (so results are actually at those
    // companies), or a single broad request when none were given. These are
    // cheap HTTP calls and cost no tokens.
    const targets = query.companies.length > 0 ? query.companies : [undefined];
    const responses = await Promise.all(
      targets.map((company) => fetchOne(buildUrl(query, appId, appKey, company), query.resultsPerPage)),
    );

    // Merge and de-duplicate by id (the same listing can surface under more than
    // one employer query).
    const seen = new Set<string>();
    const jobs: RawJob[] = [];
    for (const r of responses) {
      for (const job of r.jobs) {
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        jobs.push(job);
      }
    }
    const hasMore = responses.some((r) => r.full);
    return { jobs, hasMore };
  },
};
