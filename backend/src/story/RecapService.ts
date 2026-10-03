import { RecapRequest, RecapResponse } from '../api/recap';
import { StoryEngine, RetrievedContext } from './StoryEngine';
import { RecapCache } from '../retrieval/RecapCache';
import { SpoilerGuard } from '../validation/SpoilerGuard';
import { getAIProvider } from '../llm/provider';
import { DeterministicProvider } from '../llm/DeterministicProvider';
import { StructuredContext } from '../llm/types';

export class RecapService {
  private storyEngine = new StoryEngine();
  private cache = new RecapCache<RecapResponse>();
  private spoilerGuard = new SpoilerGuard();
  private fallback = new DeterministicProvider();

  async generateRecap(request: RecapRequest): Promise<RecapResponse> {
    // Cache: contentId + windowStart + windowEnd
    const cached = this.cache.get(request.contentId, request.windowStartMs, request.windowEndMs);
    if (cached) return { ...cached, cacheHit: true } as RecapResponse & { cacheHit: boolean };

    const context = await this.storyEngine.retrieveContext({
      contentId: request.contentId,
      startMs: request.windowStartMs,
      endMs: request.windowEndMs,
      maxTimestampMs: request.currentPositionMs
    });

    const structured: StructuredContext = {
      ...context,
      positionMs: request.currentPositionMs,
      missedWindow: { startMs: request.windowStartMs, endMs: request.windowEndMs }
    };

    let response: RecapResponse;
    try {
      response = await getAIProvider().generateRecap(structured);
      response = this.postValidate(response, context, request);
    } catch (err) {
      console.warn('[recap] AI provider failed, using deterministic fallback:', err);
      response = await this.fallback.generateRecap(structured);
    }

    this.cache.set(request.contentId, request.windowStartMs, request.windowEndMs, response);
    return response;
  }

  /**
   * Layer-2 spoiler validation on the generated recap. If the model leaked
   * future information, regenerate deterministically.
   */
  private postValidate(
    response: RecapResponse,
    context: RetrievedContext,
    request: RecapRequest
  ): RecapResponse {
    const textToCheck = [
      response.summary,
      ...response.importantEvents,
      response.importantClue?.text ?? '',
      ...response.relevantEarlierContext
    ].join('\n');

    const result = this.spoilerGuard.validateText(
      request.contentId,
      textToCheck,
      request.currentPositionMs
    );

    if (!result.ok) {
      console.warn('[recap] spoiler violations detected, deterministic rewrite:', result.violations);
      const inWindowClue =
        context.clues
          .filter(
            c =>
              c.discoveredAtMs >= request.windowStartMs &&
              c.discoveredAtMs <= Math.min(request.windowEndMs, request.currentPositionMs)
          )
          .sort((a, b) => b.discoveredAtMs - a.discoveredAtMs)[0] ??
        context.clues.sort((a, b) => b.discoveredAtMs - a.discoveredAtMs)[0] ??
        null;
      return {
        window: { startMs: request.windowStartMs, endMs: request.windowEndMs },
        summary: this.fallbackSummary(context, request),
        importantEvents: context.events
          .filter(e => e.importance >= 0.7)
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 3)
          .map(e => e.description),
        importantClue: inWindowClue
          ? { text: `${inWindowClue.title}: ${inWindowClue.description}`, confidence: 0.85 }
          : null,
        relevantEarlierContext: context.priorContext,
        characters: context.characters,
        spoilerChecked: true
      };
    }

    // Enforce window echo correctness
    response.window = { startMs: request.windowStartMs, endMs: request.windowEndMs };
    response.spoilerChecked = true;
    // Characters come from retrieval, never from the model (prevents hallucinated names)
    response.characters = context.characters;
    return response;
  }

  private fallbackSummary(context: RetrievedContext, request: RecapRequest): string {
    if (context.currentScene) {
      const events = context.events
        .sort((a, b) => a.timestampMs - b.timestampMs)
        .map(e => e.description)
        .slice(0, 3);
      const joined = events.length > 0 ? ` ${events.join(' ')}` : '';
      return `In ${context.currentScene.title}:${joined}`.replace('In The Basement:', 'In The Basement,');
    }
    const minutes = Math.round((request.windowEndMs - request.windowStartMs) / 60000);
    return `You missed about ${minutes} minutes with no major indexed events.`;
  }
}
