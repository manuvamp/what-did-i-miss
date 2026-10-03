import { RetrievedContext } from '../story/StoryEngine';
import { RecapResponse } from '../api/recap';
import { QuestionResponse } from '../api/question';

/**
 * The structured context handed to the LLM. Never raw transcripts.
 * Everything here has already passed retrieval-layer spoiler filtering.
 */
export interface StructuredContext extends RetrievedContext {
  positionMs: number;
  missedWindow: { startMs: number; endMs: number };
}

export interface AIProvider {
  readonly name: string;
  generateRecap(context: StructuredContext): Promise<RecapResponse>;
  answerQuestion(question: string, context: StructuredContext): Promise<QuestionResponse>;
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
