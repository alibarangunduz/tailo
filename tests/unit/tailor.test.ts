import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anthropic } from '@ai-sdk/anthropic';
import { buildTailorPrompt, cleanTailorOutput, streamTailor, TAILOR_MODEL } from '@/lib/tailor';
import { systemPrompt } from '@/lib/prompts';
import { streamingModel } from '../helpers/mock-model';

vi.mock('@ai-sdk/anthropic', () => ({ anthropic: vi.fn() }));

const input = {
  masterCV: 'MASTER CV TEXT',
  jobDescription: 'JD TEXT',
  company: 'Fabrikam',
  jobTitle: 'Engineer',
};

describe('buildTailorPrompt', () => {
  it('includes the CV, the company, the role and the job description', () => {
    const p = buildTailorPrompt(input);
    expect(p).toContain('## Master CV\nMASTER CV TEXT');
    expect(p).toContain('Company: Fabrikam');
    expect(p).toContain('Role: Engineer');
    expect(p).toContain('JD TEXT');
    expect(p).not.toContain('Supplemental Experience');
  });

  it('adds supplemental details as a section when present', () => {
    const p = buildTailorPrompt({
      ...input,
      supplementalDetails: [{ requirement: 'Kafka', note: 'Ran a cluster in production' }],
    });
    expect(p).toContain('## Supplemental Experience\n- Kafka: Ran a cluster in production');
  });

  it('omits the section for an empty list', () => {
    expect(buildTailorPrompt({ ...input, supplementalDetails: [] })).not.toContain('Supplemental');
  });
});

describe('cleanTailorOutput', () => {
  it.each([
    ['```json\n{"a":1}\n```', '{"a":1}'],
    ['```\n{"a":1}\n```', '{"a":1}'],
    ['  {"a":1}  ', '{"a":1}'],
    ['```JSON {"a":1}```', '{"a":1}'],
  ])('strips fences from %j', (raw, clean) => {
    expect(cleanTailorOutput(raw)).toBe(clean);
  });

  it('leaves fences inside the JSON alone', () => {
    const text = '{"code":"```x```"}';
    expect(cleanTailorOutput(text)).toBe(text);
  });
});

describe('streamTailor', () => {
  beforeEach(() => vi.mocked(anthropic).mockReset());

  it('calls the shipping model with the system prompt and a generous output cap', async () => {
    const model = streamingModel('{"ok":true}');
    vi.mocked(anthropic).mockReturnValue(model as never);

    const text = await streamTailor(input).text;

    expect(text).toBe('{"ok":true}');
    expect(anthropic).toHaveBeenCalledWith(TAILOR_MODEL);
    expect(TAILOR_MODEL).toBe('claude-sonnet-5-5');
    const call = model.doStreamCalls[0];
    // Sonnet 5.5 always thinks and thinking counts against this cap.
    expect(call.maxOutputTokens).toBeGreaterThanOrEqual(16_000);
    expect(call.providerOptions).toEqual({ anthropic: { effort: 'medium' } });
    expect(call.prompt[0]).toEqual({ role: 'system', content: systemPrompt });
  });

  it('uses provider defaults for a model without options', async () => {
    const model = streamingModel('{}');
    vi.mocked(anthropic).mockReturnValue(model as never);
    await streamTailor(input, { model: 'claude-other' }).text;
    expect(anthropic).toHaveBeenCalledWith('claude-other');
    expect(model.doStreamCalls[0].providerOptions).toBeUndefined();
  });
});
