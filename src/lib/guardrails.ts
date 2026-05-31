// Input guardrails: the single source of truth for what the app accepts before
// anything reaches the LLM, the database, or the PDF parser. Limits are enforced
// server-side (authoritative) and re-used on the client for input caps and
// counters. The goal is twofold: bound token spend (large inputs cost real
// money) and reject obviously abusive payloads before a request is processed.
//
// Validation is expressed as Zod schemas; the thin wrappers below adapt a
// schema's result into the GuardrailResult the routes already consume.

import { z } from 'zod';

// Character caps for free-text fields. Roughly: 4 chars per token, so 30k chars
// is about 7.5k tokens, a generous ceiling for a detailed master CV.
export const LIMITS = {
  cvChars: 30_000, // master CV text (paste or extracted from PDF)
  jobDescriptionChars: 20_000, // pasted job description
  shortFieldChars: 200, // company, job title, CV name, settings name/email/etc.
  supplementalMaxItems: 20, // "fill the gap" notes per regenerate
  supplementalNoteChars: 1_000, // each requirement + note
  uploadBytes: 5 * 1024 * 1024, // 5 MB max PDF upload
  companiesMaxItems: 10, // targeted companies per job search
  locationChars: 100, // job search location text (e.g. "Berlin")
  keywordsChars: 200, // job search keywords / sector text (e.g. "fintech")
} as const;

// Formats a number with comma thousands separators, independent of the server's
// locale (Node's toLocaleString() would otherwise use the host locale, e.g.
// rendering 30000 as "30.000", which reads like a decimal).
const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export interface GuardrailFailure {
  ok: false;
  status: number; // HTTP status the route should return
  error: string; // user-facing message
}
export type GuardrailResult = { ok: true } | GuardrailFailure;

const OK: GuardrailResult = { ok: true };
const fail = (status: number, error: string): GuardrailFailure => ({ ok: false, status, error });

// Maps a Zod parse result to a GuardrailResult. A "too big" issue (a `.max()`
// breach) is a payload-size problem, so it maps to 413; everything else
// (missing, wrong type, failed refinement) is a 400.
function toResult(parsed: z.ZodSafeParseResult<unknown>): GuardrailResult {
  if (parsed.success) return OK;
  const issue = parsed.error.issues[0];
  return fail(issue.code === 'too_big' ? 413 : 400, issue.message);
}

// Flags egregiously abusive free text before it is sent to the LLM. This is
// defense in depth, not a silver bullet: the length caps above are the primary
// cost control. We catch the cheap, high-signal cases: a single character (or
// short run) repeated to pad the payload, which is the usual way to burn tokens
// without writing real content.
function looksAbusive(text: string): boolean {
  // A run of 1000+ identical characters is not real CV / job-description text.
  if (/(.)\1{999,}/.test(text)) return true;
  // The same short token repeated hundreds of times (e.g. "spam spam spam...").
  if (/(\b\w{1,12}\b)(\s+\1){300,}/i.test(text)) return true;
  return false;
}

// A required, length-capped, non-abusive free-text body (CV, job description).
function bodyText(label: string, max: number) {
  return z
    .string({ error: `${label} is required.` })
    .max(max, `${label} is too long (max ${fmt(max)} characters).`)
    .refine((v) => v.trim().length > 0, `${label} is required.`)
    .refine((v) => !looksAbusive(v), `${label} looks invalid.`);
}

// A required, length-capped short field (company, job title, CV name, etc.).
function shortField(label: string) {
  return z
    .string({ error: `${label} is required.` })
    .min(1, `${label} is required.`)
    .max(LIMITS.shortFieldChars, `${label} is too long (max ${LIMITS.shortFieldChars} characters).`);
}

const cvTextSchema = bodyText('CV', LIMITS.cvChars);

const supplementalItemSchema = z
  .object({
    requirement: z.string().optional(),
    note: z.string().optional(),
  })
  .refine(
    (d) => `${d.requirement ?? ''}${d.note ?? ''}`.length <= LIMITS.supplementalNoteChars,
    `A supplemental detail is too long (max ${fmt(LIMITS.supplementalNoteChars)} characters).`,
  )
  .refine(
    (d) => !looksAbusive(`${d.requirement ?? ''}${d.note ?? ''}`),
    'A supplemental detail looks invalid.',
  );

const tailorSchema = z.object({
  masterCV: bodyText('CV', LIMITS.cvChars),
  jobDescription: bodyText('Job description', LIMITS.jobDescriptionChars),
  company: shortField('Company'),
  jobTitle: shortField('Job title'),
  supplementalDetails: z
    .array(supplementalItemSchema)
    .max(LIMITS.supplementalMaxItems, `Too many supplemental details (max ${LIMITS.supplementalMaxItems}).`)
    .optional(),
});

// File metadata schema: type then size, so a non-PDF reports as such (415) and
// an oversized PDF reports a size error (413). Built from the File's own fields.
const uploadSchema = z
  .object({ name: z.string(), type: z.string(), size: z.number() })
  .refine(
    (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    { error: 'Only PDF files are supported.', path: ['type'] },
  )
  .refine((f) => f.size <= LIMITS.uploadBytes, {
    error: `File is too large (max ${LIMITS.uploadBytes / (1024 * 1024)} MB).`,
    path: ['size'],
  });

// The job search payload. `companies` and `keywords` are optional (a user may
// search by location alone); each company is a capped short field, and the count
// is bounded so the built provider query stays small. `location` and `keywords`
// are capped free text. The master CV is referenced by id and its ownership is
// checked in the route, so it is not part of this schema.
const jobSearchSchema = z.object({
  companies: z
    .array(shortField('Company'))
    .max(LIMITS.companiesMaxItems, `Too many companies (max ${LIMITS.companiesMaxItems}).`)
    .optional(),
  location: z
    .string()
    .max(LIMITS.locationChars, `Location is too long (max ${LIMITS.locationChars} characters).`)
    .optional(),
  remote: z.boolean().optional(),
  keywords: z
    .string()
    .max(LIMITS.keywordsChars, `Keywords are too long (max ${LIMITS.keywordsChars} characters).`)
    .refine((v) => !looksAbusive(v), 'Keywords look invalid.')
    .optional(),
  page: z.number().int().min(1).max(50).optional(),
});

// Caps a single short free-text field (company, job title, CV name, etc.).
export function validateShortField(value: unknown, label: string): GuardrailResult {
  return toResult(shortField(label).safeParse(value));
}

// Validates the full /api/jobs/search payload. Returns the first failure, or ok.
export function validateJobSearchInput(input: unknown): GuardrailResult {
  return toResult(jobSearchSchema.safeParse(input));
}

// Caps the master CV text (used by /api/tailor and /api/master-cv writes).
export function validateCvText(value: unknown): GuardrailResult {
  return toResult(cvTextSchema.safeParse(value));
}

// Validates the full /api/tailor payload. Returns the first failure, or ok.
export function validateTailorInput(input: unknown): GuardrailResult {
  return toResult(tailorSchema.safeParse(input));
}

// Validates an uploaded file before it is read into memory and parsed. A non-PDF
// is a 415; an oversized PDF is a 413; a missing file is a 400.
export function validateUpload(file: File | null): GuardrailResult {
  if (!file) return fail(400, 'Missing file.');
  const parsed = uploadSchema.safeParse({ name: file.name, type: file.type, size: file.size });
  if (parsed.success) return OK;
  const issue = parsed.error.issues[0];
  // The PDF-type refinement (path "type") is an unsupported-media-type error.
  const status = issue.path[0] === 'type' ? 415 : 413;
  return fail(status, issue.message);
}
