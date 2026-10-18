// The PDF export rules from AGENTS.md, checked on real renders: one page,
// ATS-readable (real selectable text, extracted back out with unpdf), per-user
// contact header, and the auto-fit bounds.
import { describe, expect, it } from 'vitest';
import { extractText, getDocumentProxy } from 'unpdf';
import { fitCvPdf } from '@/lib/cv-pdf';
import type { TailorResult } from '@/lib/types';
import { sampleResult } from '../fixtures/sample-cv';

async function pdfText(blob: Blob): Promise<string> {
  const doc = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
  const { text } = await extractText(doc, { mergePages: true });
  return text;
}

const header = {
  name: 'Jordan Example',
  email: 'jordan@example.com',
  phone: '+49 30 0000000',
  linkedin: 'linkedin.com/in/jordan-example',
  website: 'jordan.example',
};

function withExperience(n: number, bullets: number): TailorResult {
  const r = sampleResult();
  const base = r.tailoredCV.experience[0];
  r.tailoredCV.experience = Array.from({ length: n }, (_, i) => ({
    ...base,
    title: `Engineer ${i}`,
    subsections: [
      {
        heading: '',
        bullets: Array.from(
          { length: bullets },
          (_, j) => `Delivered measurable outcome ${j} across a long sentence that wraps onto a second line in the export.`,
        ),
      },
    ],
  }));
  return r;
}

describe('fitCvPdf', () => {
  it('renders a normal CV on one page with selectable text', async () => {
    const fit = await fitCvPdf(sampleResult(), header);
    expect(fit.pages).toBe(1);
    expect(fit.scale).toBeGreaterThanOrEqual(0.85);
    expect(fit.scale).toBeLessThanOrEqual(1.18);
    expect(fit.truncatedHeaders).toEqual([]);

    const text = await pdfText(fit.blob);
    for (const expected of [
      'Jordan Example',
      'jordan@example.com',
      'Northwind Payments GmbH',
      'Senior Software Engineer',
      'March 2022 – Present',
      'Built a TypeScript SDK used by 30 merchant integrations.',
      'Technical University of Exampleton',
      'Ledgerlite',
    ]) {
      expect(text.replace(/\s+/g, ' ')).toContain(expected);
    }
  });

  it('uses the caller’s header, not the default one', async () => {
    const text = await pdfText((await fitCvPdf(sampleResult(), header)).blob);
    expect(text).toContain('Jordan Example');
    expect(text).not.toContain('Ali Baran');
  });

  it('grows a short CV to the maximum scale', async () => {
    const r = sampleResult();
    r.tailoredCV.experience = r.tailoredCV.experience.slice(0, 1);
    r.tailoredCV.projects = [];
    expect((await fitCvPdf(r, header)).scale).toBe(1.18);
  });

  it('shrinks a long CV to fit one page', async () => {
    const fit = await fitCvPdf(withExperience(7, 4), header);
    expect(fit.pages).toBe(1);
    expect(fit.scale).toBeLessThan(1.18);
  });

  it('reports overflow honestly when content cannot fit', async () => {
    const fit = await fitCvPdf(withExperience(12, 6), header);
    expect(fit.pages).toBeGreaterThan(1);
    expect(fit.scale).toBe(0.85);
  });

  it('flags a company too long for the role header line', async () => {
    const r = sampleResult();
    r.tailoredCV.experience[0].company =
      'Northwind Payments and Settlement Infrastructure Services International Holding GmbH';
    const fit = await fitCvPdf(r, header);
    expect(fit.truncatedHeaders).toHaveLength(1);
    expect(fit.truncatedHeaders[0]).toMatch(/^Senior Software Engineer, Northwind/);
  });

  it('transliterates Turkish letters the built-in fonts cannot draw', async () => {
    const r = sampleResult();
    r.tailoredCV.experience[0].location = 'İstanbul';
    const text = await pdfText((await fitCvPdf(r, header)).blob);
    expect(text).toContain('Istanbul');
    expect(text).not.toContain('İ');
  });
});
