import { describe, it, expect, beforeAll } from 'vitest';
import { StoryEngine } from '../../backend/src/story/StoryEngine';
import { RecapService } from '../../backend/src/story/RecapService';
import { QuestionService } from '../../backend/src/story/QuestionService';
import { setAIProvider } from '../../backend/src/llm/provider';
import { DeterministicProvider } from '../../backend/src/llm/DeterministicProvider';

const contentId = 'sintel_001';
// The twist: the fallen dragon in the cave is Scales, the little dragon from the
// rooftops, grown up. The index was rebuilt from the frames of the film itself
// (see content/sintel/ANALYSIS_NOTES.md). Reveal events:
//   event_024 (journey images flash behind Sintel's face: the fallen dragon is Scales) @ 605.9s
//   event_025 (Sintel reaches out an open hand toward the fallen dragon)               @ 608.9s
// Both are gated behind spoilerBoundaryMs = 622s so recaps cannot surface them
// before the reveal beat has finished playing.
const REVEAL_BOUNDARY = 622_000;

function expectNoReveal(text: string) {
  for (const phrase of ['grown up', 'is scales', 'fallen dragon', 'struck down', 'open hand']) {
    expect(text).not.toContain(phrase);
  }
}

describe('Sintel spoiler safety', () => {
  const engine = new StoryEngine();

  beforeAll(() => {
    setAIProvider(new DeterministicProvider());
  });

  it('recap at 5:00 (300s) does not mention the dragon reveal', async () => {
    const service = new RecapService();
    const recap = await service.generateRecap({
      contentId,
      currentPositionMs: 300_000,
      windowStartMs: 240_000,
      windowEndMs: 300_000
    });
    const text = [recap.summary, ...recap.importantEvents, recap.importantClue?.text ?? ''].join(' ').toLowerCase();
    // Naming the little dragon "Scales" is fine (the film does); tying it to the
    // cave dragon is the spoiler.
    expectNoReveal(text);
    expect(recap.spoilerChecked).toBe(true);
  });

  it('recap and highlights at 10:15 (615s), in the cave just before the reveal, keep the twist hidden', async () => {
    const service = new RecapService();
    for (const windowMs of [120_000, 600_000]) {
      const recap = await service.generateRecap({
        contentId,
        currentPositionMs: 615_000,
        windowStartMs: 615_000 - windowMs,
        windowEndMs: 615_000
      });
      const text = [
        recap.summary,
        ...recap.importantEvents,
        recap.importantClue?.text ?? '',
        ...(recap.highlights ?? []).map(h => h.caption)
      ].join(' ').toLowerCase();
      expectNoReveal(text);
    }
  });

  it('clues listing at 4:00 (240s) omits later clues', async () => {
    const service = new QuestionService();
    const res = await service.answer({
      contentId,
      question: 'What clues do we know so far?',
      currentPositionMs: 240_000
    });
    // clue_03 (a much larger dragon) is discovered at 283s and clue_07 (the reveal) at 605.9s
    expect(res.answer).not.toContain('Larger Dragon');
    expect(res.answer).not.toContain('Fallen Dragon');
    expect(res.answer).not.toContain('grown up');
    expect(res.spoilerChecked).toBe(true);
  });

  it('retrieveContext at 10:00 (600s) excludes the reveal events', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 540_000,
      endMs: 600_000,
      maxTimestampMs: 600_000
    });
    expect(ctx.events.find(e => e.id === 'event_024')).toBeUndefined();
    expect(ctx.events.find(e => e.id === 'event_025')).toBeUndefined();
    // the events just before the reveal are still available
    expect(ctx.events.find(e => e.id === 'event_023')).toBeDefined();
    expect(ctx.clues.find(c => c.id === 'clue_07')).toBeUndefined();
  });

  it('retrieveContext at 10:15 (615s) still excludes the reveal (boundary 622s)', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 560_000,
      endMs: 615_000,
      maxTimestampMs: 615_000
    });
    // event_024 happens at 605.9s but is gated behind spoilerBoundaryMs = 622s
    expect(ctx.events.find(e => e.id === 'event_024')).toBeUndefined();
    expect(ctx.events.find(e => e.id === 'event_025')).toBeUndefined();
  });

  it('retrieveContext at 10:25 (625s) includes the reveal', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 560_000,
      endMs: 625_000,
      maxTimestampMs: 625_000
    });
    expect(REVEAL_BOUNDARY).toBeLessThanOrEqual(625_000);
    expect(ctx.events.find(e => e.id === 'event_024')).toBeDefined();
    expect(ctx.events.find(e => e.id === 'event_025')).toBeDefined();
  });

  it('prior context in the cave links back to the early little-dragon scenes', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 560_000,
      endMs: 600_000,
      maxTimestampMs: 600_000
    });
    // Sintel's static relationship to "Scales" pulls the rooftop scenes back in
    // without revealing anything about the adult dragon.
    const joined = ctx.priorContext.join(' ').toLowerCase();
    expect(joined).toMatch(/little dragon|winged creature/);
  });
});
