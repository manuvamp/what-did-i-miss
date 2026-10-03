import { QuestionRequest, QuestionResponse } from '../api/question';
import { StoryEngine } from './StoryEngine';
import { SpoilerGuard } from '../validation/SpoilerGuard';
import { getAIProvider } from '../llm/provider';
import { DeterministicProvider } from '../llm/DeterministicProvider';
import { StructuredContext } from '../llm/types';

export class QuestionService {
  private storyEngine = new StoryEngine();
  private spoilerGuard = new SpoilerGuard();
  private fallback = new DeterministicProvider();

  async answer(request: QuestionRequest): Promise<QuestionResponse> {
    const context = await this.storyEngine.retrieveQuestionContext(
      request.contentId,
      request.currentPositionMs
    );

    const structured: StructuredContext = {
      ...context,
      positionMs: request.currentPositionMs,
      missedWindow: {
        startMs: Math.max(0, request.currentPositionMs - 5 * 60 * 1000),
        endMs: request.currentPositionMs
      }
    };

    let response: QuestionResponse;
    try {
      response = await getAIProvider().answerQuestion(request.question, structured);
    } catch (err) {
      console.warn('[question] AI provider failed, using deterministic fallback:', err);
      response = await this.fallback.answerQuestion(request.question, structured);
    }

    // Layer-2 spoiler validation
    const check = this.spoilerGuard.validateText(
      request.contentId,
      response.answer,
      request.currentPositionMs
    );
    if (!check.ok) {
      console.warn('[question] spoiler violations, deterministic rewrite:', check.violations);
      response = await this.fallback.answerQuestion(request.question, structured);
    }

    response.spoilerChecked = true;
    return response;
  }
}
