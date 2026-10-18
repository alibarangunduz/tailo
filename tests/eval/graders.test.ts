// Offline tier of the tailoring eval. The paid run (npm run eval:tailor) calls
// the real model; this suite pins down its graders on synthetic outputs, at no
// cost, so a grader regression cannot silently pass or fail a model or prompt.
// It also grades a known-good output through the real PDF render: when a prompt
// or layout change breaks the one-page or format rules, this fails first.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { anthropic } from '@ai-sdk/anthropic';
import {
  dateFormat,
  educationFormat,
  gradeCase,
  namesExact,
  skillsGrounded,
  validateResult,
  withinBudget,
  type EvalCase,
  type Run,
} from '../../evals/tailor/tailor-eval';
import { fitCvPdf } from '@/lib/cv-pdf';
import type { TailorResult, TailoredCVContent } from '@/lib/types';
import { JOB, MASTER_CV, sampleResult } from '../fixtures/sample-cv';
import { generatingModel } from '../helpers/mock-model';

vi.mock('@ai-sdk/anthropic', () => ({ anthropic: vi.fn() }));

const evalCase: EvalCase = {
  id: 'synthetic_01',
  tags: ['synthetic'],
  meta: {},
  ...JOB,
  prompt: `${JOB.company} / ${JOB.jobTitle}`,
  masterCV: MASTER_CV,
};

const cv = (edit: (cv: TailoredCVContent) => void = () => {}) => {
  const c = sampleResult().tailoredCV;
  edit(c);
  return c;
};

async function runFor(result: TailorResult | null): Promise<Run> {
  const fit = result ? await fitCvPdf(result) : null;
  return {
    output: JSON.stringify(result),
    parsed: result,
    parseError: result ? undefined : 'JSON.parse: Unexpected end of JSON input',
    pages: fit?.pages ?? null,
    fitScale: fit?.scale ?? null,
    transcript: [],
    model: 'mock',
    usage: {},
    stop_reason: 'end_turn',
  };
}

describe('validateResult', () => {
  it('accepts a complete result', () => {
    expect(validateResult(sampleResult())).toBeNull();
  });

  it.each([
    ['matchScore', (r: TailorResult) => delete (r as Partial<TailorResult>).matchScore, 'matchScore missing'],
    ['a score key', (r: TailorResult) => delete (r.scoreBreakdown as Partial<TailorResult['scoreBreakdown']>).seniorityFit, 'scoreBreakdown.seniorityFit missing'],
    ['education as array', (r: TailorResult) => ((r.tailoredCV as unknown as { education: string[] }).education = ['x']), 'education is not a string'],
    ['bullets', (r: TailorResult) => delete (r.tailoredCV.experience[0].subsections[0] as Partial<{ bullets: string[] }>).bullets, 'subsection.bullets missing'],
  ])('flags missing %s', (_, mutate, message) => {
    const r = sampleResult();
    mutate(r);
    expect(validateResult(r)).toBe(message);
  });
});

describe('withinBudget', () => {
  it('passes the sample', () => expect(withinBudget(cv())).toBeNull());
  it('caps the summary at 80 words', () => {
    expect(withinBudget(cv((c) => (c.summary = 'word '.repeat(81))))).toMatch(/summary 81 words/);
  });
  it('caps skills at 5 categories', () => {
    expect(withinBudget(cv((c) => (c.skills = Array(6).fill(c.skills[0]))))).toMatch(/6 skill/);
  });
  it('caps bullets at 14 across roles', () => {
    const tooMany = cv((c) => (c.experience[0].subsections[0].bullets = Array(13).fill('b')));
    expect(withinBudget(tooMany)).toMatch(/15 bullets/);
  });
});

describe('dateFormat', () => {
  it.each(['March 2022 – Present', '2018 – 2022', 'Sept. 2020 – May 2021'])('accepts %s', (dates) => {
    expect(dateFormat(cv((c) => (c.experience[0].dates = dates))) ).toBeNull();
  });
  it.each(['March 2022 - Present', 'March 2022 — Present', '03/2022 – Present', 'March 2022–Present'])(
    'rejects %s',
    (dates) => {
      expect(dateFormat(cv((c) => (c.experience[0].dates = dates)))).toContain(dates);
    },
  );
});

describe('educationFormat', () => {
  it('passes one entry plus one certifications line', () => {
    expect(educationFormat(cv(), MASTER_CV)).toBeNull();
  });
  it('rejects more entries than the master CV has', () => {
    const c = cv((c) => (c.education = 'B.Sc. Computer Science, 2015 – 2019 | M.Sc. Data, 2019 – 2021'));
    expect(educationFormat(c, MASTER_CV)).toBe('2 education lines for 1 entries');
  });
  it('rejects two certifications lines', () => {
    const c = cv((c) => (c.education += ' | Certifications: CKA'));
    expect(educationFormat(c, MASTER_CV)).toBe('2 certifications lines');
  });
  it('rejects an entry without years', () => {
    const c = cv((c) => (c.education = 'B.Sc. Computer Science, Technical University of Exampleton'));
    expect(educationFormat(c, MASTER_CV)).toMatch(/without years/);
  });
  it('rejects a hyphenated year range', () => {
    const c = cv((c) => (c.education = 'B.Sc. Computer Science, 2015 - 2019'));
    expect(educationFormat(c, MASTER_CV)).toMatch(/without en dash/);
  });
});

describe('namesExact', () => {
  it('passes names copied from the master CV', () => {
    expect(namesExact(cv(), MASTER_CV)).toBeNull();
  });
  it('rejects an invented company', () => {
    expect(namesExact(cv((c) => (c.experience[0].company = 'Northwind Bank')), MASTER_CV)).toBe(
      'company "Northwind Bank"',
    );
  });
  it('compares company names case-sensitively', () => {
    const c = cv((c) => (c.experience[0].company = 'northwind payments gmbh'));
    expect(namesExact(c, MASTER_CV)).toMatch(/^company/);
  });
  it('rejects an inflated title', () => {
    expect(namesExact(cv((c) => (c.experience[1].title = 'Staff Engineer')), MASTER_CV)).toBe(
      'title "Staff Engineer"',
    );
  });
  it('rejects a renamed degree', () => {
    const c = cv((c) => (c.education = 'M.Sc. Computer Science, 2015 – 2019'));
    expect(namesExact(c, MASTER_CV)).toBe('degree "M.Sc. Computer Science"');
  });
});

describe('skillsGrounded', () => {
  it('scores the share of skills found in the master CV', () => {
    expect(skillsGrounded(cv(), MASTER_CV)).toBe(1);
    const c = cv((c) => (c.skills = [{ category: 'Languages', items: 'TypeScript, Rust, Go (Golang), Elixir' }]));
    expect(skillsGrounded(c, MASTER_CV)).toBe(0.5);
  });
});

describe('gradeCase', () => {
  beforeEach(() => vi.mocked(anthropic).mockReset());
  afterEach(() => vi.restoreAllMocks());

  const ctx = (variant: string) => ({ variant, flow: 'unused', rep: 1 });

  it('a known-good output passes every check through the real PDF render', async () => {
    const { grade, explanation } = await gradeCase(evalCase, await runFor(sampleResult()), null, ctx('baseline'));
    expect(explanation).toEqual({});
    expect(grade).toMatchObject({
      checks_pass: 1,
      valid_json: 1,
      one_page: 1,
      budget: 1,
      date_format: 1,
      edu_format: 1,
      names_exact: 1,
      skills_in_cv: 1,
      win: 0.5,
    });
    expect(anthropic).not.toHaveBeenCalled();
  });

  it('one failing check fails the headline and is explained', async () => {
    const r = sampleResult();
    r.tailoredCV.experience[0].dates = 'March 2022 - Present';
    const { grade, explanation } = await gradeCase(evalCase, await runFor(r), null, ctx('baseline'));
    expect(grade.checks_pass).toBe(0);
    expect(grade.date_format).toBe(0);
    expect(Object.keys(explanation)).toEqual(['date_format']);
  });

  it('an unparseable output scores zero everywhere and is not judged', async () => {
    const { grade } = await gradeCase(evalCase, await runFor(null), null, ctx('v1'));
    expect(grade).toMatchObject({ checks_pass: 0, valid_json: 0, one_page: 0, win: 0 });
    expect(anthropic).not.toHaveBeenCalled();
  });

  it.each([
    // [random, verdict, expected win]: the candidate sits in slot A when random < 0.5
    [0.1, 'A', 1],
    [0.1, 'B', 0],
    [0.9, 'B', 1],
    [0.9, 'A', 0],
    [0.9, 'tie', 0.5],
  ] as const)('maps the judge verdict back through the A/B shuffle (random %s, %s)', async (rand, winner, win) => {
    vi.spyOn(Math, 'random').mockReturnValue(rand);
    const candidateIsA = rand < 0.5;
    vi.mocked(anthropic).mockReturnValue(
      generatingModel(
        JSON.stringify({
          honesty_issues_a: candidateIsA ? ['invented metric'] : [],
          honesty_issues_b: candidateIsA ? [] : ['invented metric'],
          winner,
          reason: 'test',
        }),
      ) as never,
    );
    const ref = JSON.stringify(sampleResult());
    const { grade, explanation } = await gradeCase(evalCase, await runFor(sampleResult()), ref, ctx('v1'));
    expect(grade.win).toBe(win);
    // The honesty issue was always the candidate's, whichever slot it sat in.
    expect(grade.honest).toBe(0);
    expect(explanation.honest).toBe('invented metric');
    expect(explanation.ref_honesty).toBe('no issues found');
  });
});
