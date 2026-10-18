import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  validateCvText,
  validateShortField,
  validateTailorInput,
  validateUpload,
} from '@/lib/guardrails';

const validTailor = {
  masterCV: 'Jordan Example, backend engineer.',
  jobDescription: 'Senior Backend Engineer, TypeScript.',
  company: 'Fabrikam',
  jobTitle: 'Senior Backend Engineer',
};

describe('validateTailorInput', () => {
  it('accepts a normal payload', () => {
    expect(validateTailorInput(validTailor)).toEqual({ ok: true });
  });

  it('accepts supplemental details within the caps', () => {
    const r = validateTailorInput({
      ...validTailor,
      supplementalDetails: [{ requirement: 'Kafka', note: 'Ran it in production.' }],
    });
    expect(r.ok).toBe(true);
  });

  it.each(['masterCV', 'jobDescription', 'company', 'jobTitle'] as const)(
    'rejects a missing %s with 400',
    (field) => {
      const r = validateTailorInput({ ...validTailor, [field]: undefined });
      expect(r).toMatchObject({ ok: false, status: 400 });
    },
  );

  it('rejects a whitespace-only CV with 400', () => {
    expect(validateTailorInput({ ...validTailor, masterCV: '   \n ' })).toMatchObject({
      ok: false,
      status: 400,
      error: 'CV is required.',
    });
  });

  it('rejects an oversized CV with 413 and a comma-formatted limit', () => {
    const r = validateTailorInput({ ...validTailor, masterCV: 'a b '.repeat(LIMITS.cvChars) });
    expect(r).toMatchObject({ ok: false, status: 413 });
    expect(!r.ok && r.error).toContain('30,000');
  });

  it('rejects an oversized job description with 413', () => {
    const r = validateTailorInput({
      ...validTailor,
      jobDescription: 'x y '.repeat(LIMITS.jobDescriptionChars),
    });
    expect(r).toMatchObject({ ok: false, status: 413 });
  });

  it('rejects a short field over the cap with 413', () => {
    const r = validateTailorInput({
      ...validTailor,
      company: 'c'.repeat(LIMITS.shortFieldChars + 1),
    });
    expect(r).toMatchObject({ ok: false, status: 413 });
  });

  it('rejects single-character padding as abusive', () => {
    const r = validateTailorInput({ ...validTailor, masterCV: `CV ${'a'.repeat(1000)}` });
    expect(r).toMatchObject({ ok: false, status: 400, error: 'CV looks invalid.' });
  });

  it('rejects a repeated short token as abusive', () => {
    const r = validateTailorInput({
      ...validTailor,
      jobDescription: Array(400).fill('spam').join(' '),
    });
    expect(r).toMatchObject({ ok: false, status: 400, error: 'Job description looks invalid.' });
  });

  it('does not flag ordinary repetition in real text', () => {
    const cv = Array(50).fill('Built TypeScript services and Go pipelines.').join('\n');
    expect(validateTailorInput({ ...validTailor, masterCV: cv }).ok).toBe(true);
  });

  it('caps the number of supplemental details', () => {
    const r = validateTailorInput({
      ...validTailor,
      supplementalDetails: Array(LIMITS.supplementalMaxItems + 1).fill({
        requirement: 'r',
        note: 'n',
      }),
    });
    expect(r).toMatchObject({ ok: false, status: 413 });
  });

  it('caps the length of one supplemental detail', () => {
    const r = validateTailorInput({
      ...validTailor,
      supplementalDetails: [{ requirement: 'r', note: 'word '.repeat(LIMITS.supplementalNoteChars) }],
    });
    expect(r.ok).toBe(false);
  });
});

describe('validateShortField and validateCvText', () => {
  it('accepts a normal value', () => {
    expect(validateShortField('My CV', 'CV name')).toEqual({ ok: true });
    expect(validateCvText('Some CV text')).toEqual({ ok: true });
  });

  it('labels the error with the field name', () => {
    expect(validateShortField('', 'CV name')).toMatchObject({ error: 'CV name is required.' });
  });

  it('rejects non-strings', () => {
    expect(validateShortField(42, 'Name').ok).toBe(false);
    expect(validateCvText({ text: 'x' }).ok).toBe(false);
  });
});

describe('validateUpload', () => {
  const file = (name: string, type: string, size: number) =>
    new File([new Uint8Array(size)], name, { type });

  it('accepts a PDF under the size cap', () => {
    expect(validateUpload(file('cv.pdf', 'application/pdf', 1024))).toEqual({ ok: true });
  });

  it('accepts a .pdf name even without a MIME type', () => {
    expect(validateUpload(file('CV.PDF', '', 10)).ok).toBe(true);
  });

  it('returns 400 for a missing file', () => {
    expect(validateUpload(null)).toMatchObject({ ok: false, status: 400 });
  });

  it('returns 415 for a non-PDF', () => {
    expect(validateUpload(file('cv.docx', 'application/msword', 10))).toMatchObject({
      ok: false,
      status: 415,
    });
  });

  it('returns 413 for an oversized PDF', () => {
    expect(
      validateUpload(file('cv.pdf', 'application/pdf', LIMITS.uploadBytes + 1)),
    ).toMatchObject({ ok: false, status: 413 });
  });
});
