// /api/jobs/search with the real ranking pipeline (profile, query, prefilter,
// one generateText ranking call). Adzuna and the model are faked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anthropic } from '@ai-sdk/anthropic';
import { POST } from '@/app/api/jobs/search/route';
import { adzunaProvider } from '@/lib/jobs/adzuna';
import { ProviderNotConfiguredError, type RawJob } from '@/lib/jobs/provider';
import { prisma, resetPrisma } from '../helpers/prisma-mock';
import { signInAs } from '../helpers/auth-mock';
import { generatingModel } from '../helpers/mock-model';
import { MASTER_CV } from '../fixtures/sample-cv';

vi.mock('@/auth', () => import('../helpers/auth-mock'));
vi.mock('@/lib/db', () => import('../helpers/prisma-mock'));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: vi.fn() }));
vi.mock('@/lib/jobs/adzuna', () => ({ adzunaProvider: { search: vi.fn() } }));

const search = vi.mocked(adzunaProvider.search);

const raw = (id: string, title = 'Backend Engineer'): RawJob => ({
  id,
  title,
  company: 'Acme',
  location: 'Berlin',
  url: `https://example.com/${id}`,
  salary: null,
  description: 'TypeScript Kafka PostgreSQL role',
});

// Each test uses its own user and keywords so the route's cache and rate limit
// never leak between tests.
let n = 0;
let USER = '';
const post = (payload: Record<string, unknown>) =>
  POST(
    new Request('http://localhost/api/jobs/search', {
      method: 'POST',
      body: JSON.stringify({ masterCVId: 'cv1', keywords: `kw${n}`, ...payload }),
      headers: { 'content-type': 'application/json' },
    }),
  );

beforeEach(() => {
  resetPrisma();
  search.mockReset();
  vi.mocked(anthropic).mockReset();
  USER = `jobs-user-${++n}`;
  signInAs(USER);
  prisma.masterCV.findFirst.mockResolvedValue({ content: MASTER_CV });
});

describe('POST /api/jobs/search', () => {
  it('returns jobs in the model’s ranked order with its scores', async () => {
    search.mockResolvedValue({ jobs: [raw('a'), raw('b'), raw('c')], hasMore: true });
    vi.mocked(anthropic).mockReturnValue(
      generatingModel(
        JSON.stringify({
          ranked: [
            { id: 'c', matchScore: 91, whyItFits: 'Kafka' },
            { id: 'a', matchScore: 140, whyItFits: 'TS' },
          ],
        }),
      ) as never,
    );

    const res = await post({});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobs.map((j: { id: string }) => j.id)).toEqual(['c', 'a', 'b']);
    expect(data.jobs[0]).toMatchObject({ matchScore: 91, whyItFits: 'Kafka' });
    expect(data.jobs[1].matchScore).toBe(100); // clamped
    expect(data.jobs[2].whyItFits).toBe('Matched on your CV keywords and filters.');
    expect(data.nextPage).toBe(2);
    expect(anthropic).toHaveBeenCalledWith('claude-haiku-4-5');
  });

  it('never sends the full CV to the ranking model', async () => {
    search.mockResolvedValue({ jobs: [raw('a')], hasMore: false });
    const model = generatingModel('{"ranked":[]}');
    vi.mocked(anthropic).mockReturnValue(model as never);
    await post({});
    const sent = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(sent).not.toContain('Jordan Example');
    expect(sent).not.toContain('jordan@example.com');
  });

  it('falls back to local ranking when the model output is not JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    search.mockResolvedValue({ jobs: [raw('a'), raw('b')], hasMore: false });
    vi.mocked(anthropic).mockReturnValue(generatingModel('sorry, no') as never);
    const data = await (await post({})).json();
    expect(data.jobs).toHaveLength(2);
    expect(data.nextPage).toBeNull();
  });

  it('serves an identical repeat search from cache', async () => {
    search.mockResolvedValue({ jobs: [raw('a')], hasMore: false });
    vi.mocked(anthropic).mockReturnValue(generatingModel('{"ranked":[]}') as never);
    await post({});
    await post({});
    expect(search).toHaveBeenCalledOnce();
  });

  it('skips the model when the provider returns nothing', async () => {
    search.mockResolvedValue({ jobs: [], hasMore: false });
    expect(await (await post({})).json()).toEqual({ jobs: [], nextPage: null });
    expect(anthropic).not.toHaveBeenCalled();
  });

  it('answers 404 for another user’s CV', async () => {
    prisma.masterCV.findFirst.mockResolvedValue(null);
    expect((await post({ masterCVId: 'theirs' })).status).toBe(404);
    expect(prisma.masterCV.findFirst.mock.calls[0][0].where).toEqual({ id: 'theirs', userId: USER });
    expect(search).not.toHaveBeenCalled();
  });

  it('requires a CV id', async () => {
    expect((await post({ masterCVId: undefined })).status).toBe(400);
  });

  it('maps a missing provider configuration to 503 and other failures to 502', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    search.mockRejectedValueOnce(new ProviderNotConfiguredError('not configured'));
    expect((await post({})).status).toBe(503);
    search.mockRejectedValueOnce(new Error('network'));
    expect((await post({ keywords: 'other' })).status).toBe(502);
  });

  it('validates input before calling the provider', async () => {
    const res = await post({ companies: Array(11).fill('Acme') });
    expect(res.status).toBe(413);
    expect(search).not.toHaveBeenCalled();
  });
});
