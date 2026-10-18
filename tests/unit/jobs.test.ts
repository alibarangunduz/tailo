import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildQuery, extractCvProfile, prefilter } from '@/lib/jobs/rank';
import { adzunaProvider } from '@/lib/jobs/adzuna';
import { ProviderNotConfiguredError, type RawJob } from '@/lib/jobs/provider';
import { MASTER_CV } from '../fixtures/sample-cv';

const job = (over: Partial<RawJob>): RawJob => ({
  id: 'j1',
  title: 'Engineer',
  company: 'Acme',
  location: 'Berlin',
  url: 'https://example.com/j1',
  salary: null,
  description: '',
  ...over,
});

describe('extractCvProfile', () => {
  it('ranks frequent, meaningful words and drops stopwords', () => {
    const p = extractCvProfile('TypeScript typescript TypeScript kafka kafka the and with experience');
    expect(p.keywords.slice(0, 2)).toEqual(['typescript', 'kafka']);
    expect(p.keywords).not.toContain('the');
    expect(p.keywords).not.toContain('experience');
    expect(p.profileText).toContain('typescript, kafka');
  });

  it('caps the keyword list so the ranking prompt stays small', () => {
    const p = extractCvProfile(MASTER_CV.repeat(3));
    expect(p.keywords.length).toBeLessThanOrEqual(40);
    expect(p.profileText).not.toContain('Jordan Example');
  });
});

describe('buildQuery', () => {
  const profile = { keywords: ['typescript', 'kafka', 'go', 'postgresql', 'aws', 'docker'], profileText: '' };

  it('uses the user keywords, comma separated input normalized', () => {
    const q = buildQuery(profile, { companies: [], keywords: 'fintech,  backend', page: 2 }, 20);
    expect(q).toMatchObject({ keywords: 'fintech backend', page: 2, resultsPerPage: 20, remote: false });
  });

  it('falls back to the top five CV keywords for a broad search', () => {
    expect(buildQuery(profile, { companies: [], page: 1 }, 20).keywords).toBe(
      'typescript kafka go postgresql aws',
    );
  });

  it('leaves keywords empty for a company search', () => {
    expect(buildQuery(profile, { companies: ['SAP'], page: 1 }, 20).keywords).toBe('');
  });

  it('drops a blank location', () => {
    expect(buildQuery(profile, { companies: [], location: '  ', page: 1 }, 20).location).toBeUndefined();
  });
});

describe('prefilter', () => {
  const profile = extractCvProfile('typescript kafka postgresql typescript kafka');

  it('puts targeted employers first, then location, then keyword overlap', () => {
    const jobs = [
      job({ id: 'kw', title: 'TypeScript Kafka Engineer', company: 'Other', location: 'Paris' }),
      job({ id: 'loc', company: 'Other', location: 'Berlin Mitte' }),
      job({ id: 'co', company: 'Acme GmbH', location: 'Paris' }),
    ];
    const ranked = prefilter(jobs, profile, { companies: ['acme'], location: 'berlin' }, 10);
    expect(ranked.map((r) => r.job.id)).toEqual(['co', 'loc', 'kw']);
  });

  it('returns at most `limit` jobs', () => {
    const jobs = Array.from({ length: 30 }, (_, i) => job({ id: String(i) }));
    expect(prefilter(jobs, profile, { companies: [] }, 15)).toHaveLength(15);
  });
});

describe('adzunaProvider', () => {
  const query = { keywords: 'typescript', companies: [], page: 1, resultsPerPage: 2 };

  beforeEach(() => {
    vi.stubEnv('ADZUNA_APP_ID', 'id');
    vi.stubEnv('ADZUNA_APP_KEY', 'key');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('throws ProviderNotConfiguredError without credentials', async () => {
    vi.stubEnv('ADZUNA_APP_KEY', '');
    await expect(adzunaProvider.search(query)).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it('maps listings, drops predicted salaries and formats real ones', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        results: [
          {
            id: 1,
            title: ' Backend Engineer ',
            company: { display_name: 'Acme' },
            location: { display_name: 'Berlin' },
            redirect_url: 'https://adzuna.example/1',
            salary_min: 70000,
            salary_max: 90000,
          },
          { id: 2, salary_min: 50000, salary_is_predicted: '1' },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { jobs, hasMore } = await adzunaProvider.search(query);

    expect(jobs[0]).toMatchObject({
      id: '1',
      title: 'Backend Engineer',
      company: 'Acme',
      salary: '€70,000 - €90,000',
    });
    expect(jobs[1]).toMatchObject({ title: 'Untitled role', company: 'Unknown company', salary: null, url: null });
    expect(hasMore).toBe(true);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('what')).toBe('typescript');
  });

  it('queries each targeted company by phrase and de-duplicates', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => Response.json({ results: [{ id: 'same' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const { jobs } = await adzunaProvider.search({ ...query, companies: ['SAP', 'Zalando'] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const phrases = fetchMock.mock.calls.map(([u]) => new URL(u).searchParams.get('what_phrase'));
    expect(phrases).toEqual(['SAP', 'Zalando']);
    expect(jobs).toHaveLength(1);
  });

  it('treats a failed request as empty instead of failing the search', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    expect(await adzunaProvider.search(query)).toEqual({ jobs: [], hasMore: false });
  });
});
