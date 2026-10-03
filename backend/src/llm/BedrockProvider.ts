import { AIProvider, StructuredContext } from './types';
import { buildRecapPrompt, buildQuestionPrompt } from './promptBuilder';
import { RecapResponse } from '../api/recap';
import { QuestionResponse } from '../api/question';
import { config } from '../config';

/**
 * Amazon Bedrock provider (Claude models via bedrock-runtime InvokeModel).
 * Loaded lazily so the backend works without the AWS SDK installed when
 * AI_PROVIDER is not "bedrock".
 */
export class BedrockProvider implements AIProvider {
  readonly name = 'bedrock';
  private clientPromise: Promise<any> | null = null;

  private async getClient(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const mod = await import('@aws-sdk/client-bedrock-runtime');
        return new mod.BedrockRuntimeClient({ region: config.bedrock.region });
      })();
    }
    return this.clientPromise;
  }

  async generateRecap(context: StructuredContext): Promise<RecapResponse> {
    const text = await this.invoke(buildRecapPrompt(context), 800);
    const parsed = this.extractJson(text);
    return {
      window: { startMs: context.missedWindow.startMs, endMs: context.missedWindow.endMs },
      summary: String(parsed.summary ?? ''),
      importantEvents: Array.isArray(parsed.importantEvents) ? parsed.importantEvents.map(String) : [],
      importantClue: parsed.importantClue
        ? {
            text: String(parsed.importantClue.text ?? ''),
            confidence: typeof parsed.importantClue.confidence === 'number' ? parsed.importantClue.confidence : 0.8
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
    const text = await this.invoke(buildQuestionPrompt(question, context), 400);
    const parsed = this.extractJson(text);
    return { answer: String(parsed.answer ?? "I don't have enough context to answer that yet."), spoilerChecked: true };
  }

  private async invoke(prompt: string, maxTokens: number): Promise<string> {
    const client = await this.getClient();
    const mod = await import('@aws-sdk/client-bedrock-runtime');
    const command = new mod.InvokeModelCommand({
      modelId: config.bedrock.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        system:
          'You are a spoiler-safe story memory for television. You only ever use the structured context provided. You never reveal, infer, or hint at future events. You return only valid JSON.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const response = await client.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    const text = body?.content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('Bedrock returned no text content');
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
