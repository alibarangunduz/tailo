import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { systemPrompt } from '@/lib/prompts';
import { prisma } from '@/lib/db';
import { validateTailorInput } from '@/lib/guardrails';
import { getCurrentUserId, unauthorized } from '@/lib/session';
import { rateLimitedResponse } from '@/lib/rate-limit';

// Caps the model's output so a single run cannot balloon. The tailored CV is
// budgeted to one page of JSON, so this sits comfortably above a valid response.
const MAX_OUTPUT_TOKENS = 4_000;

// Tailoring is the most expensive call in the app; cap how often one user can
// trigger it (security hardening gap 7).
const RATE_LIMIT = { limit: 20, windowMs: 60_000 };

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const limited = rateLimitedResponse('tailor', userId, RATE_LIMIT);
  if (limited) return limited;

  const { masterCV, masterCVId, jobDescription, company, jobTitle, supplementalDetails } =
    await req.json();

  // Guardrails: reject oversized or abusive input before spending any tokens.
  const check = validateTailorInput({ masterCV, jobDescription, company, jobTitle, supplementalDetails });
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  // If the client points at a saved CV, it must be one this user owns; otherwise
  // ignore it and fall through to creating a fresh CV in onFinish.
  let ownedMasterCVId: string | null = null;
  if (masterCVId) {
    const owned = await prisma.masterCV.findFirst({
      where: { id: masterCVId, userId },
      select: { id: true },
    });
    if (!owned) return Response.json({ error: 'Not found' }, { status: 404 });
    ownedMasterCVId = owned.id;
  }

  // Real details the user confirmed for specific gaps but had not yet added to
  // the master CV. The system prompt allows these to be used as truthful facts.
  const supplementalBlock =
    Array.isArray(supplementalDetails) && supplementalDetails.length > 0
      ? `\n\n## Supplemental Experience\n${supplementalDetails
          .map(
            (d: { requirement: string; note: string }) => `- ${d.requirement}: ${d.note}`,
          )
          .join('\n')}`
      : '';

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    system: systemPrompt,
    prompt: `## Master CV\n${masterCV}\n\n## Target Job Description\nCompany: ${company}\nRole: ${jobTitle}\n\n${jobDescription}${supplementalBlock}\n\nAnalyze the gap between this CV and the job description. Then generate a tailored version.`,
    onFinish: async ({ text }) => {
      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      try {
        const parsed = JSON.parse(cleaned);

        let cvId = ownedMasterCVId;
        if (!cvId) {
          const firstLine = masterCV
            .split('\n')
            .map((l: string) => l.trim())
            .find(Boolean);
          const created = await prisma.masterCV.create({
            data: { name: firstLine?.slice(0, 60) || 'Untitled CV', content: masterCV, userId },
          });
          cvId = created.id;
        }

        await prisma.tailoredCV.create({
          data: {
            userId,
            masterCVId: cvId,
            jobTitle,
            company,
            jobDescription,
            tailoredContent: cleaned,
            matchScore: parsed.matchScore ?? 0,
            gapAnalysis: JSON.stringify(parsed.gaps ?? []),
            strengthAnalysis: JSON.stringify(parsed.strengths ?? []),
          },
        });
      } catch (err) {
        console.error('Failed to save tailored CV to history:', err);
      }
    },
  });

  return result.toTextStreamResponse();
}
