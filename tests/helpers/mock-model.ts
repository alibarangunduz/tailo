// Fake language models for the AI SDK. Tests mock `@ai-sdk/anthropic` so that
// `anthropic(id)` returns one of these: the real streamText / generateText,
// onFinish and toTextStreamResponse code paths still run, only the network call
// to Anthropic is replaced.
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 50, text: 50, reasoning: 0 },
};

// Streams `text` in small deltas, then finishes with the given reason.
export function streamingModel(text: string, finish: 'stop' | 'length' = 'stop') {
  const deltas = text.match(/[\s\S]{1,40}/g) ?? [];
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'text-start' as const, id: 't1' },
        ...deltas.map((delta) => ({ type: 'text-delta' as const, id: 't1', delta })),
        { type: 'text-end' as const, id: 't1' },
        {
          type: 'finish' as const,
          finishReason: { unified: finish, raw: finish === 'stop' ? 'end_turn' : 'max_tokens' },
          usage,
        },
      ]),
    }),
  });
}

// Returns `text` from a single non-streaming generate call.
export function generatingModel(text: string) {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text }],
      finishReason: { unified: 'stop' as const, raw: 'end_turn' },
      usage,
      warnings: [],
    }),
  });
}
