import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Returns a single master CV (with content) by id, or 404 if not found.
export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/master-cv/[id]'>,
) {
  const { id } = await ctx.params;
  const cv = await prisma.masterCV.findUnique({ where: { id } });
  if (!cv) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(cv);
}

// Deletes a master CV by id. Its tailored versions reference it via a
// required relation, so they are removed first in the same transaction.
export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/master-cv/[id]'>,
) {
  const { id } = await ctx.params;
  try {
    await prisma.$transaction([
      prisma.tailoredCV.deleteMany({ where: { masterCVId: id } }),
      prisma.masterCV.delete({ where: { id } }),
    ]);
  } catch {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
