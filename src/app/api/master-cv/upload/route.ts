import { parsePDF } from '@/lib/pdf-parser';

// Parses an uploaded PDF and returns its text. Does not persist anything;
// the caller saves the master CV explicitly via POST/PUT /api/master-cv.
export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return Response.json({ error: 'Missing file' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const content = await parsePDF(buffer);

  return Response.json({ content });
}
