import { prisma } from '@/lib/db';
import { getCurrentUserId, unauthorized } from '@/lib/session';

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const history = await prisma.tailoredCV.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      masterCV: { select: { name: true } },
    },
  });
  return Response.json(history);
}
