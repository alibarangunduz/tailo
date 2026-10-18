// The tailoring LLM call, shared by /api/tailor and the eval runner
// (evals/tailor) so the eval always exercises exactly what ships.

import { streamText, type StreamTextOnFinishCallback, type ToolSet } from "ai";
import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from "@ai-sdk/anthropic";
import { systemPrompt } from "@/lib/prompts";
import type { SupplementalDetail } from "@/lib/types";

export const TAILOR_MODEL = "claude-sonnet-5-5";

// Caps the model's output so a single run cannot balloon. Sonnet 5.5 always
// thinks, and thinking tokens count against this cap, so it must cover both the
// thinking and the one-page JSON response.
const MAX_OUTPUT_TOKENS = 16_000;

// Per-model provider options. Medium effort keeps thinking proportionate for a
// structured rewrite task; models without an entry run on provider defaults.
const PROVIDER_OPTIONS: Record<string, AnthropicLanguageModelOptions> = {
  "claude-sonnet-5-5": { effort: "medium" },
};

export interface TailorInput {
  masterCV: string;
  jobDescription: string;
  company: string;
  jobTitle: string;
  supplementalDetails?: SupplementalDetail[];
}

export function buildTailorPrompt(input: TailorInput): string {
  const { masterCV, jobDescription, company, jobTitle, supplementalDetails } =
    input;

  // Real details the user confirmed for specific gaps but had not yet added to
  // the master CV. The system prompt allows these to be used as truthful facts.
  const supplementalBlock =
    Array.isArray(supplementalDetails) && supplementalDetails.length > 0
      ? `\n\n## Supplemental Experience\n${supplementalDetails
          .map((d) => `- ${d.requirement}: ${d.note}`)
          .join("\n")}`
      : "";

  return `## Master CV\n${masterCV}\n\n## Target Job Description\nCompany: ${company}\nRole: ${jobTitle}\n\n${jobDescription}${supplementalBlock}\n\nAnalyze the gap between this CV and the job description. Then generate a tailored version.`;
}

export function streamTailor(
  input: TailorInput,
  options: {
    model?: string;
    onFinish?: StreamTextOnFinishCallback<ToolSet>;
  } = {},
) {
  const model = options.model ?? TAILOR_MODEL;
  const providerOptions = PROVIDER_OPTIONS[model];
  return streamText({
    model: anthropic(model),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    ...(providerOptions
      ? { providerOptions: { anthropic: providerOptions } }
      : {}),
    system: systemPrompt,
    prompt: buildTailorPrompt(input),
    onFinish: options.onFinish,
  });
}

// Strips a markdown code fence if the model wrapped its JSON in one.
export function cleanTailorOutput(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}
