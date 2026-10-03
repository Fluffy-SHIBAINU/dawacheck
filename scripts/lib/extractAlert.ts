import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { ALERT_KINDS } from '../../src/core/types';
import type { ExtractedAlert } from './alerts';

// Structured outputs (messages.parse + zodOutputFormat) instead of a forced tool call:
// forced tool_choice conflicts with Opus 5's default adaptive thinking.
const MODEL = 'claude-opus-5';

const AlertSchema = z.object({
  kind: z.enum(ALERT_KINDS as unknown as [string, ...string[]]),
  summary: z.string().describe('Plain English, at most 280 characters.'),
  appliesToNigeria: z
    .boolean()
    .describe('false only when the alert relays a foreign recall and says the product is not known to be in Nigeria.'),
  products: z.array(
    z.object({
      brand: z.string().nullable(),
      ingredient: z.string().nullable(),
      strength: z.string().nullable(),
      manufacturer: z.string().nullable(),
      nrn: z.string().nullable().describe('NAFDAC registration number if stated, e.g. A4-1234'),
      batches: z.array(z.string()).describe('Batch or lot numbers exactly as printed.'),
    }),
  ),
});

let client: Anthropic | null = null;

export async function extractAlert(text: string, title: string): Promise<ExtractedAlert> {
  client ??= new Anthropic();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: zodOutputFormat(AlertSchema) },
    messages: [
      {
        role: 'user',
        content: `Extract the facts from this NAFDAC public alert. Use null for anything not stated. Copy batch numbers exactly.\n\nTITLE: ${title}\n\nTEXT:\n${text.slice(0, 12000)}`,
      },
    ],
  });
  if (response.stop_reason === 'refusal') throw new Error('model declined the request');
  if (!response.parsed_output) throw new Error('no structured output returned');
  return response.parsed_output as ExtractedAlert;
}
