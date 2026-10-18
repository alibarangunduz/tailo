import { prisma } from "@/lib/db";
import { validateTailorInput } from "@/lib/guardrails";
import { getCurrentUserId, unauthorized } from "@/lib/session";
import { rateLimitedResponse } from "@/lib/rate-limit";
import { cleanTailorOutput, streamTailor } from "@/lib/tailor";

// Tailoring is the most expensive call in the app; cap how often one user can
// trigger it (security hardening gap 7).
const RATE_LIMIT = { limit: 20, windowMs: 60_000 };

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const limited = rateLimitedResponse("tailor", userId, RATE_LIMIT);
  if (limited) return limited;

  const {
    masterCV,
    masterCVId,
    jobDescription,
    company,
    jobTitle,
    supplementalDetails,
  } = await req.json();

  // Guardrails: reject oversized or abusive input before spending any tokens.
  const check = validateTailorInput({
    masterCV,
    jobDescription,
    company,
    jobTitle,
    supplementalDetails,
  });
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
    if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
    ownedMasterCVId = owned.id;
  }

  const result = streamTailor(
    { masterCV, jobDescription, company, jobTitle, supplementalDetails },
    {
      onFinish: async ({ text, finishReason, usage }) => {
        const cleaned = cleanTailorOutput(text);
        try {
          const parsed = JSON.parse(cleaned);

          let cvId = ownedMasterCVId;
          if (!cvId) {
            const firstLine = masterCV
              .split("\n")
              .map((l: string) => l.trim())
              .find(Boolean);
            const created = await prisma.masterCV.create({
              data: {
                name: firstLine?.slice(0, 60) || "Untitled CV",
                content: masterCV,
                userId,
              },
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
          console.error("Failed to save tailored CV to history:", err, {
            finishReason,
            outputTokens: usage.outputTokens,
            textLength: text.length,
            tail: text.slice(-200),
          });
        }
      },
    },
  );

  return result.toTextStreamResponse();
}
