import { describe, it, expect, beforeAll } from 'vitest';
import { StoryEngine } from '../../backend/src/story/StoryEngine';
import { RecapService } from '../../backend/src/story/RecapService';
import { QuestionService } from '../../backend/src/story/QuestionService';
import { setAIProvider } from '../../backend/src/llm/provider';
import { DeterministicProvider } from '../../backend/src/llm/DeterministicProvider';

const contentId = 'sintel_001';
// The twist: the adult dragon is Scales grown up. Reveal events:
//   event_020 (dragon recognizes Sintel)  @ 624s, boundary 690s
//   event_021 (Sintel realizes it's Scales) @ 640s, boundary 690s
//   event_022/023 (cradles / sobs)        @ 654s/672s, boundary 690s
const REVEAL_BOUNDARY = 690_000;

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
    expect(text).not.toContain('scales grown');
    expect(text).not.toContain('recognizes sintel');
    expect(text).not.toContain('realizes the dragon');
    expect(text).not.toContain('cradles');
    expect(text).not.toContain('sobs');
    expect(recap.spoilerChecked).toBe(true);
  });

  it('clues listing at 4:00 (240s) omits the late recognition clue', async () => {
    const service = new QuestionService();
    const res = await service.answer({
      contentId,
      question: 'What clues do we know so far?',
      currentPositionMs: 240_000
    });
    // clue_07 (dragon recognizes Sintel) is discovered at 624s — must not appear at 240s
    expect(res.answer).not.toContain('Recognizes Sintel');
    expect(res.answer).not.toContain('recognizes');
    expect(res.spoilerChecked).toBe(true);
  });

  it('retrieveContext at 10:00 (600s) excludes the reveal events', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 540_000,
      endMs: 600_000,
      maxTimestampMs: 600_000
    });
    expect(ctx.events.find(e => e.id === 'event_020')).toBeUndefined();
    expect(ctx.events.find(e => e.id === 'event_021')).toBeUndefined();
    expect(ctx.events.find(e => e.id === 'event_022')).toBeUndefined();
    expect(ctx.events.find(e => e.id === 'event_023')).toBeUndefined();
  });

  it('retrieveContext at 11:00 (660s) excludes the whole reveal sequence (boundary 690s)', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 600_000,
      endMs: 660_000,
      maxTimestampMs: 660_000
    });
    // The fight and recognition are all gated behind spoilerBoundaryMs = 690s,
    // so at 660s none of the final-act events are retrievable yet.
    expect(ctx.events.find(e => e.id === 'event_019')).toBeUndefined();
    expect(ctx.events.find(e => e.id === 'event_020')).toBeUndefined();
    expect(ctx.events.find(e => e.id === 'event_021')).toBeUndefined();
  });

  it('retrieveContext at 11:35 (695s) includes the reveal', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 600_000,
      endMs: 695_000,
      maxTimestampMs: 695_000
    });
    expect(ctx.events.find(e => e.id === 'event_021')).toBeDefined();
  });

  it('prior context at the fight links back to the early Scales bond', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 600_000,
      endMs: 660_000,
      maxTimestampMs: 660_000
    });
    // The recap at the fight should surface the early Scales relationship
    const joined = ctx.priorContext.join(' ').toLowerCase();
    expect(joined).toMatch(/scales|baby dragon|pets|bond/);
  });
});
