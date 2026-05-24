import { prisma } from '@/lib/db';
import { validateCvText, validateShortField } from '@/lib/guardrails';

export async function GET() {
  const cvs = await prisma.masterCV.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return Response.json(cvs);
}

export async function POST(req: Request) {
  const { name, content } = await req.json();
  // Guardrails: cap name and content length before persisting.
  const nameCheck = validateShortField(name, 'CV name');
  if (!nameCheck.ok) return Response.json({ error: nameCheck.error }, { status: nameCheck.status });
  const contentCheck = validateCvText(content);
  if (!contentCheck.ok) return Response.json({ error: contentCheck.error }, { status: contentCheck.status });

  const cv = await prisma.masterCV.create({ data: { name, content } });
  return Response.json(cv, { status: 201 });
}

export async function PUT(req: Request) {
  const { id, name, content } = await req.json();
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
  // Guardrails: validate any provided field before updating.
  if (name !== undefined) {
    const nameCheck = validateShortField(name, 'CV name');
    if (!nameCheck.ok) return Response.json({ error: nameCheck.error }, { status: nameCheck.status });
  }
  if (content !== undefined) {
    const contentCheck = validateCvText(content);
    if (!contentCheck.ok) return Response.json({ error: contentCheck.error }, { status: contentCheck.status });
  }
  const cv = await prisma.masterCV.update({
    where: { id },
    data: { ...(name && { name }), ...(content && { content }) },
  });
  return Response.json(cv);
}
