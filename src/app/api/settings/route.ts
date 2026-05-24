import { prisma } from '@/lib/db';
import { defaultCvHeader } from '@/lib/cv-header';
import { validateShortField } from '@/lib/guardrails';

// Single-user MVP: the contact header lives in one Settings row keyed by a
// fixed id. The first GET seeds it from the default header constant.
const SETTINGS_ID = 'singleton';

export async function GET() {
  const settings = await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID, ...defaultCvHeader },
  });
  return Response.json(settings);
}

export async function PUT(req: Request) {
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
    where: { id: SETTINGS_ID },
    update: { name, email, phone, linkedin, website },
    create: { id: SETTINGS_ID, name, email, phone, linkedin, website },
  });
  return Response.json(settings);
}
