import { parsePDF } from '@/lib/pdf-parser';
import { validateUpload, validateCvText } from '@/lib/guardrails';
import { getCurrentUserId, unauthorized } from '@/lib/session';

// Parses an uploaded PDF and returns its text. Does not persist anything;
// the caller saves the master CV explicitly via POST/PUT /api/master-cv.
// Requires a session: parsing is CPU work, so it must not be open to anonymous
// callers who could spam large files.
export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  // Guardrails: reject non-PDF or oversized files before reading into memory.
  const check = validateUpload(file);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const buffer = Buffer.from(await file!.arrayBuffer());
  const content = await parsePDF(buffer);

  // A PDF that extracts to more text than we accept for a master CV is rejected
  // here rather than silently truncated downstream.
  const sizeCheck = validateCvText(content);
  if (!sizeCheck.ok) {
    return Response.json({ error: sizeCheck.error }, { status: sizeCheck.status });
  }

  return Response.json({ content });
}
