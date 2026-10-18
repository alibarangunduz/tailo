import { prisma } from '@/lib/db';
import { emptyCvHeader } from '@/lib/cv-header';
import { validateShortField } from '@/lib/guardrails';
import { getCurrentUserId, unauthorized } from '@/lib/session';

// The contact header is one Settings row per user, keyed by userId. The first
// GET for a user seeds it with their own account name and email; the other
// fields start empty for the user to fill in.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const existing = await prisma.settings.findUnique({ where: { userId } });
  if (existing) return Response.json(existing);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const settings = await prisma.settings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...emptyCvHeader,
      name: user?.name ?? '',
      email: user?.email ?? '',
    },
  });
  return Response.json(settings);
}

export async function PUT(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const { name, email, phone, linkedin, website } = await req.json();
  if (!name || !email) {
    return Response.json({ error: 'Name and email are required' }, { status: 400 });
  }
  // Guardrails: every header field is a short free-text value; cap each.
  for (const [value, label] of [
    [name, 'Name'], [email, 'Email'], [phone, 'Phone'],
    [linkedin, 'LinkedIn'], [website, 'Website'],
  ] as const) {
    if (value === undefined || value === '') continue; // phone/linkedin/website optional
    const r = validateShortField(value, label);
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  }

  const settings = await prisma.settings.upsert({
    where: { userId },
    update: { name, email, phone, linkedin, website },
    create: { userId, name, email, phone, linkedin, website },
  });
  return Response.json(settings);
}
