// /api/master-cv/upload with real PDF parsing (unpdf). The PDF under test is one
// the app itself exported, so this is also an export to re-import round trip.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/master-cv/upload/route';
import { parsePDF } from '@/lib/pdf-parser';
import { fitCvPdf } from '@/lib/cv-pdf';
import { LIMITS } from '@/lib/guardrails';
import { signInAs } from '../helpers/auth-mock';
import { sampleResult } from '../fixtures/sample-cv';

vi.mock('@/auth', () => import('../helpers/auth-mock'));
vi.mock('@/lib/pdf-parser', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/pdf-parser')>();
  return { parsePDF: vi.fn(real.parsePDF) };
});

let pdfBytes: ArrayBuffer;
beforeAll(async () => {
  pdfBytes = await (await fitCvPdf(sampleResult())).blob.arrayBuffer();
});

const upload = (file: File | null) => {
  const form = new FormData();
  if (file) form.append('file', file);
  return POST(new Request('http://localhost/api/master-cv/upload', { method: 'POST', body: form }));
};

beforeEach(() => {
  signInAs('user-a');
  vi.mocked(parsePDF).mockClear();
});

describe('POST /api/master-cv/upload', () => {
  it('extracts the text of an uploaded PDF', async () => {
    const res = await upload(new File([pdfBytes], 'cv.pdf', { type: 'application/pdf' }));
    expect(res.status).toBe(200);
    const { content } = await res.json();
    expect(content).toContain('Northwind Payments GmbH');
    expect(content).toContain('Ledgerlite');
  });

  it('rejects a missing file with 400', async () => {
    expect((await upload(null)).status).toBe(400);
  });

  it('rejects a non-PDF with 415 without parsing it', async () => {
    const res = await upload(new File(['hello'], 'cv.txt', { type: 'text/plain' }));
    expect(res.status).toBe(415);
    expect(parsePDF).not.toHaveBeenCalled();
  });

  it('rejects an oversized PDF with 413 without parsing it', async () => {
    const big = new File([new Uint8Array(LIMITS.uploadBytes + 1)], 'cv.pdf', {
      type: 'application/pdf',
    });
    expect((await upload(big)).status).toBe(413);
    expect(parsePDF).not.toHaveBeenCalled();
  });

  it('rejects a PDF whose text exceeds the master CV cap', async () => {
    vi.mocked(parsePDF).mockResolvedValueOnce('word '.repeat(LIMITS.cvChars));
    const res = await upload(new File([pdfBytes], 'cv.pdf', { type: 'application/pdf' }));
    expect(res.status).toBe(413);
  });
});
