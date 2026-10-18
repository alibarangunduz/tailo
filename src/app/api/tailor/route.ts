import { prisma } from "@/lib/db";
import { validateTailorInput } from "@/lib/guardrails";
import { getCurrentUserId, unauthorized } from "@/lib/session";
import { rateLimitedResponse } from "@/lib/rate-limit";
import { cleanTailorOutput, streamTailor } from "@/lib/tailor";

// Tailoring is the most expensive call in the app; cap how often one user can
// trigger it.
const RATE_LIMIT = { limit: 20, windowMs: 60_000 };

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorized();

  const limited = rateLimitedResponse("tailor", userId, RATE_LIMIT);
  if (limited) return limited;

  const { masterCVId, jobDescription, company, jobTitle, supplementalDetails } =
    await req.json();

  // Tailoring always runs on a master CV the user saved. The text comes from
  // the database, not the request body, so the run and its history entry
  // match what the user actually stored.
  if (!masterCVId || typeof masterCVId !== "string") {
    return Response.json(
      { error: "Save your master CV before tailoring." },
      { status: 400 },
    );
  }
  const owned = await prisma.masterCV.findFirst({
    where: { id: masterCVId, userId },
    select: { id: true, content: true },
  });
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
  const masterCV = owned.content;

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

  const result = streamTailor(
    { masterCV, jobDescription, company, jobTitle, supplementalDetails },
    {
      onFinish: async ({ text, finishReason, usage }) => {
        const cleaned = cleanTailorOutput(text);
        try {
          const parsed = JSON.parse(cleaned);
          await prisma.tailoredCV.create({
            data: {
              userId,
              masterCVId: owned.id,
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
          // Counts and error names only: the model output and the JSON parse
          // message both contain CV content, which must never reach the logs.
          console.error("Failed to save tailored CV to history:", {
            error: err instanceof Error ? err.name : "unknown",
            finishReason,
            outputTokens: usage.outputTokens,
            textLength: text.length,
          });
        }
      },
    },
  );

  return result.toTextStreamResponse();
}
