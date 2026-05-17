import { prisma } from '@/lib/db';

export async function GET() {
  const cvs = await prisma.masterCV.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return Response.json(cvs);
}

export async function POST(req: Request) {
  const { name, content } = await req.json();
  if (!name || !content) {
    return Response.json({ error: 'Missing name or content' }, { status: 400 });
  }
  const cv = await prisma.masterCV.create({ data: { name, content } });
  return Response.json(cv, { status: 201 });
}

export async function PUT(req: Request) {
  const { id, name, content } = await req.json();
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
  const cv = await prisma.masterCV.update({
    where: { id },
    data: { ...(name && { name }), ...(content && { content }) },
  });
  return Response.json(cv);
}
