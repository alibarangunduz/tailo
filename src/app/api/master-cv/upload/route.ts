import { parsePDF } from '@/lib/pdf-parser';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const name = formData.get('name') as string | null;

  if (!file || !name) {
    return Response.json({ error: 'Missing file or name' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const content = await parsePDF(buffer);

  const cv = await prisma.masterCV.create({ data: { name, content } });
  return Response.json(cv, { status: 201 });
}
