import { prisma } from '@/lib/db';
import { getCurrentUserId, unauthorized } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Returns a single master CV (with content) by id, scoped to the owner. Another
// user's id returns 404 (not 403) so record existence is not leaked.
export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/master-cv/[id]'>,
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  const cv = await prisma.masterCV.findFirst({ where: { id, userId } });
  if (!cv) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(cv);
}

// Deletes a master CV by id, only if it belongs to the caller. Its tailored
// versions reference it via a required relation, so they are removed first in
// the same transaction.
export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/master-cv/[id]'>,
) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { id } = await ctx.params;
  // Confirm ownership before deleting; a non-owned or missing id is a 404.
  const owned = await prisma.masterCV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return Response.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.tailoredCV.deleteMany({ where: { masterCVId: id } }),
    prisma.masterCV.delete({ where: { id } }),
  ]);
  return new Response(null, { status: 204 });
}
