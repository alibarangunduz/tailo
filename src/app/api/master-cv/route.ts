import { prisma } from '@/lib/db';
import { validateCvText, validateShortField } from '@/lib/guardrails';
import { getCurrentUserId, unauthorized } from '@/lib/session';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const cvs = await prisma.masterCV.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return Response.json(cvs);
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { name, content } = await req.json();
  // Guardrails: cap name and content length before persisting.
  const nameCheck = validateShortField(name, 'CV name');
  if (!nameCheck.ok) return Response.json({ error: nameCheck.error }, { status: nameCheck.status });
  const contentCheck = validateCvText(content);
  if (!contentCheck.ok) return Response.json({ error: contentCheck.error }, { status: contentCheck.status });

  const cv = await prisma.masterCV.create({ data: { name, content, userId } });
  return Response.json(cv, { status: 201 });
}

export async function PUT(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

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

  // Scope the update to the owner: updateMany only touches rows matching both id
  // and userId, so another user's CV is never modified. A zero count means the
  // CV does not exist or is not theirs, reported as 404.
  const result = await prisma.masterCV.updateMany({
    where: { id, userId },
    data: { ...(name && { name }), ...(content && { content }) },
  });
  if (result.count === 0) return Response.json({ error: 'Not found' }, { status: 404 });

  const cv = await prisma.masterCV.findUnique({ where: { id } });
  return Response.json(cv);
}
