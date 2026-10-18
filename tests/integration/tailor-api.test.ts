// /api/tailor end to end inside the process: the real route, guardrails, rate
// limiter, streamTailor, AI SDK streamText, toTextStreamResponse and onFinish
// persistence all run. Only the Anthropic model and Prisma are fakes.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anthropic } from '@ai-sdk/anthropic';
import { POST } from '@/app/api/tailor/route';
import { LIMITS } from '@/lib/guardrails';
import { prisma, resetPrisma } from '../helpers/prisma-mock';
import { signInAs } from '../helpers/auth-mock';
import { streamingModel } from '../helpers/mock-model';
import { JOB, MASTER_CV, sampleResult } from '../fixtures/sample-cv';

vi.mock('@/auth', () => import('../helpers/auth-mock'));
vi.mock('@/lib/db', () => import('../helpers/prisma-mock'));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: vi.fn() }));

// The limiter is per user and process-wide, so each test signs in fresh.
let n = 0;
let USER = '';

const body = (over: Record<string, unknown> = {}) => ({ masterCV: MASTER_CV, ...JOB, ...over });
const post = (payload: unknown) =>
  POST(
    new Request('http://localhost/api/tailor', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    }),
  );

function modelReturning(text: string) {
  const model = streamingModel(text);
  vi.mocked(anthropic).mockReturnValue(model as never);
  return model;
}

beforeEach(() => {
  resetPrisma();
  vi.mocked(anthropic).mockReset();
  USER = `tailor-user-${++n}`;
  signInAs(USER);
  prisma.masterCV.create.mockResolvedValue({ id: 'created-cv' });
  prisma.tailoredCV.create.mockResolvedValue({ id: 'tailored' });
});

describe('POST /api/tailor', () => {
  it('streams the model output and saves it to the caller’s history', async () => {
    const result = sampleResult();
    const raw = '```json\n' + JSON.stringify(result) + '\n```';
    modelReturning(raw);

    const res = await post(body());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(raw);

    await vi.waitFor(() => expect(prisma.tailoredCV.create).toHaveBeenCalledOnce());
    const saved = prisma.tailoredCV.create.mock.calls[0][0].data;
    expect(saved).toMatchObject({
      userId: USER,
      masterCVId: 'created-cv',
      company: JOB.company,
      jobTitle: JOB.jobTitle,
      matchScore: 82,
    });
    // Stored without the code fence, so history reloads parse.
    expect(JSON.parse(saved.tailoredContent)).toEqual(result);
    expect(JSON.parse(saved.gapAnalysis)).toEqual(result.gaps);
  });

  it('creates a master CV named after the CV’s first line when none is selected', async () => {
    modelReturning(JSON.stringify(sampleResult()));
    await (await post(body())).text();
    await vi.waitFor(() => expect(prisma.masterCV.create).toHaveBeenCalledOnce());
    expect(prisma.masterCV.create.mock.calls[0][0].data).toEqual({
      name: 'Jordan Example',
      content: MASTER_CV,
      userId: USER,
    });
  });

  it('reuses a selected master CV the caller owns', async () => {
    prisma.masterCV.findFirst.mockResolvedValue({ id: 'cv1' });
    modelReturning(JSON.stringify(sampleResult()));
    await (await post(body({ masterCVId: 'cv1' }))).text();
    await vi.waitFor(() => expect(prisma.tailoredCV.create).toHaveBeenCalledOnce());
    expect(prisma.masterCV.findFirst.mock.calls[0][0].where).toEqual({ id: 'cv1', userId: USER });
    expect(prisma.masterCV.create).not.toHaveBeenCalled();
    expect(prisma.tailoredCV.create.mock.calls[0][0].data.masterCVId).toBe('cv1');
  });

  it('answers 404 for another user’s master CV, before calling the model', async () => {
    prisma.masterCV.findFirst.mockResolvedValue(null);
    const res = await post(body({ masterCVId: 'theirs' }));
    expect(res.status).toBe(404);
    expect(anthropic).not.toHaveBeenCalled();
  });

  it('rejects invalid input before spending tokens', async () => {
    expect((await post(body({ company: '' }))).status).toBe(400);
    expect((await post(body({ masterCV: 'a b '.repeat(LIMITS.cvChars) }))).status).toBe(413);
    expect(anthropic).not.toHaveBeenCalled();
  });

  it('passes supplemental details to the model', async () => {
    const model = modelReturning(JSON.stringify(sampleResult()));
    await (
      await post(body({ supplementalDetails: [{ requirement: 'Banking', note: 'Two years at a bank' }] }))
    ).text();
    expect(JSON.stringify(model.doStreamCalls[0].prompt)).toContain('Banking: Two years at a bank');
  });

  it('does not save, and does not crash, when the model returns broken JSON', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    modelReturning('{"matchScore": 80, "tailoredCV": {');
    const res = await post(body());
    expect(res.status).toBe(200);
    await res.text();
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(error.mock.calls[0][0]).toBe('Failed to save tailored CV to history:');
    expect(prisma.tailoredCV.create).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('rate limits one user at 20 requests a minute', async () => {
    modelReturning('{}');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Invalid input still counts: the limiter runs before validation.
    for (let i = 0; i < 20; i++) expect((await post(body({ company: '' }))).status).toBe(400);
    const res = await post(body());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();

    signInAs('someone-else');
    expect((await post(body({ company: '' }))).status).toBe(400);
  });
});
