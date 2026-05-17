import { prisma } from '@/lib/db';

export async function GET() {
  const history = await prisma.tailoredCV.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      masterCV: { select: { name: true } },
    },
  });
  return Response.json(history);
}
