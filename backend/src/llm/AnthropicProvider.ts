import { AIProvider, StructuredContext } from './types';
import { buildRecapPrompt, buildQuestionPrompt } from './promptBuilder';
import { RecapResponse } from '../api/recap';
import { QuestionResponse } from '../api/question';
import { config } from '../config';

/**
 * Anthropic provider: direct Messages API call via fetch.
 * Works against api.anthropic.com; also usable through a gateway by setting
 * ANTHROPIC_BASE_URL to an http(s) base URL.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

  async generateRecap(context: StructuredContext): Promise<RecapResponse> {
    const raw = await this.call(buildRecapPrompt(context), 800);
    const parsed = this.extractJson(raw);
    return {
      window: { startMs: context.missedWindow.startMs, endMs: context.missedWindow.endMs },
      summary: String(parsed.summary ?? ''),
      importantEvents: Array.isArray(parsed.importantEvents) ? parsed.importantEvents.map(String) : [],
      importantClue: parsed.importantClue
        ? {
            text: String(parsed.importantClue.text ?? ''),
            confidence: clamp(confidenceOf(parsed.importantClue.confidence), 0, 1)
          }
        : null,
      relevantEarlierContext: Array.isArray(parsed.relevantEarlierContext)
        ? parsed.relevantEarlierContext.map(String)
        : [],
      characters: context.characters,
      spoilerChecked: true
    };
  }

  async answerQuestion(question: string, context: StructuredContext): Promise<QuestionResponse> {
    const raw = await this.call(buildQuestionPrompt(question, context), 400);
    const parsed = this.extractJson(raw);
    return { answer: String(parsed.answer ?? "I don't have enough context to answer that yet."), spoilerChecked: true };
  }

  private async call(prompt: string, maxTokens: number): Promise<string> {
    if (!config.anthropic.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.anthropic.model,
        max_tokens: maxTokens,
        system:
          'You are a spoiler-safe story memory for television. You only ever use the structured context provided. You never reveal, infer, or hint at future events. You return only valid JSON.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as any;
    const text = data?.content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('Anthropic returned no text content');
    }
    return text;
  }

  private extractJson(raw: string): any {
    const cleaned = raw.replace(/```(json)?/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Model output contained no JSON object');
    }
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function confidenceOf(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0.8;
}
