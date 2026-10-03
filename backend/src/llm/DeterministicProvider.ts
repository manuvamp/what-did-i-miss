import { AIProvider, StructuredContext, formatTime } from './types';
import { RecapResponse } from '../api/recap';
import { QuestionResponse } from '../api/question';

/**
 * Deterministic provider: builds a recap purely from the story index.
 * No external calls, always available — this is both the offline fallback
 * and a regression-testable baseline for the AI path.
 */
export class DeterministicProvider implements AIProvider {
  readonly name = 'deterministic';

  async generateRecap(context: StructuredContext): Promise<RecapResponse> {
    const summary = this.buildSummary(context);
    const importantEvents = context.events
      .filter(e => e.importance >= 0.7)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3)
      .map(e => e.description);

    // Prefer a clue discovered inside the missed window; otherwise fall back
    // to the most recently discovered clue the viewer knows about.
    const topClue =
      context.clues
        .filter(
          c =>
            c.discoveredAtMs >= context.missedWindow.startMs &&
            c.discoveredAtMs <= context.missedWindow.endMs
        )
        .sort((a, b) => b.discoveredAtMs - a.discoveredAtMs)[0] ??
      context.clues.sort((a, b) => b.discoveredAtMs - a.discoveredAtMs)[0] ??
      null;

    return {
      window: { startMs: context.missedWindow.startMs, endMs: context.missedWindow.endMs },
      summary,
      importantEvents,
      importantClue: topClue
        ? { text: `${topClue.title}: ${topClue.description}`, confidence: 0.85 }
        : null,
      relevantEarlierContext: context.priorContext,
      characters: context.characters,
      spoilerChecked: true
    };
  }

  async answerQuestion(question: string, context: StructuredContext): Promise<QuestionResponse> {
    const q = question.toLowerCase();
    let answer: string;

    if (q.includes('clue')) {
      answer = this.answerClues(context);
    } else if (q.includes('who') && (q.includes('involved') || q.includes('is'))) {
      answer = this.answerCharacters(context);
    } else if (q.includes('why') && q.includes('important')) {
      answer = this.answerWhyImportant(context);
    } else if (q.includes('happened')) {
      answer = this.buildSummary(context);
    } else {
      answer = this.answerGeneric(context);
    }

    return { answer, spoilerChecked: true };
  }

  private buildSummary(context: StructuredContext): string {
    const parts: string[] = [];

    if (context.currentScene) {
      parts.push(`In ${context.currentScene.title}, ${this.lowercaseFirst(context.currentScene.summary)}`);
    }

    const topEvents = context.events
      .filter(e => e.importance >= 0.75)
      .sort((a, b) => a.timestampMs - b.timestampMs)
      .slice(0, 3);

    for (const e of topEvents) {
      if (!parts[0]?.includes(e.description)) {
        parts.push(e.description.endsWith('.') ? e.description : `${e.description}.`);
      }
    }

    if (parts.length === 0) {
      const minutes = Math.round(
        (context.missedWindow.endMs - context.missedWindow.startMs) / 60000
      );
      return `You missed approximately ${minutes} minutes of quiet buildup with no major events.`;
    }

    return parts.join(' ');
  }

  private answerClues(context: StructuredContext): string {
    if (context.clues.length === 0) {
      return 'No clues have been discovered in the story yet.';
    }
    const lines = context.clues.map(c => `${c.title} — ${c.description}`);
    return `So far you know ${context.clues.length} clue${context.clues.length > 1 ? 's' : ''}: ${lines.join(' ')}`;
  }

  private answerCharacters(context: StructuredContext): string {
    if (context.characters.length === 0) {
      return 'No character information is available for this section.';
    }
    const scene = context.currentScene;
    const charFacts = context.characterStates
      .filter(cs => context.characters.includes(cs.name))
      .map(cs => {
        const facts = cs.knownFacts.map((f: any) => f.fact);
        return `${cs.name}${facts.length > 0 ? `: ${facts.join('; ')}` : ''}`;
      });
    const joined = charFacts.length > 0 ? charFacts.join(' ') : context.characters.join(' and ');
    return `Right now the story follows ${scene ? scene.characters.join(' and ') : context.characters.join(' and ')}. ${joined}`;
  }

  private answerWhyImportant(context: StructuredContext): string {
    const latestClue = context.clues[context.clues.length - 1];
    if (!latestClue) {
      return 'Nothing in this section stands out as significant yet.';
    }

    const connections: string[] = [];
    for (const prior of context.priorContext) {
      const related =
        latestClue.relatedCharacters.some(rc => prior.includes(rc)) ||
        latestClue.relatedObjects.some(ro => prior.includes(ro));
      if (related) connections.push(prior);
    }

    if (connections.length > 0) {
      return `${latestClue.title} matters because it connects to something earlier. ${connections[0].endsWith('.') ? connections[0] : connections[0] + '.'} This suggests ${latestClue.description.charAt(0).toLowerCase()}${latestClue.description.slice(1)}`;
    }

    return `${latestClue.title} matters because ${latestClue.description.charAt(0).toLowerCase()}${latestClue.description.slice(1)}`;
  }

  private answerGeneric(context: StructuredContext): string {
    if (context.storyState) {
      const facts = context.storyState.knownFacts;
      if (facts.length > 0) {
        return `Here's what's established at this point: ${facts.join('; ')}.`;
      }
    }
    return this.buildSummary(context);
  }

  private lowercaseFirst(s: string): string {
    return s.charAt(0).toLowerCase() + s.slice(1);
  }
}
