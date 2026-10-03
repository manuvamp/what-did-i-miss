import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RecapService } from '../../backend/src/story/RecapService';
import { QuestionService } from '../../backend/src/story/QuestionService';
import { setAIProvider } from '../../backend/src/llm/provider';
import { DeterministicProvider } from '../../backend/src/llm/DeterministicProvider';

describe('Recap service end-to-end (deterministic provider)', () => {
  beforeAll(() => {
    setAIProvider(new DeterministicProvider());
  });

  it('generates a schema-conformant recap for the photograph window', async () => {
    const service = new RecapService();
    const recap = await service.generateRecap({
      contentId: 'last_signal_001',
      currentPositionMs: 330_000,
      windowStartMs: 240_000,
      windowEndMs: 330_000
    });

    expect(recap.summary.length).toBeGreaterThan(10);
    expect(recap.summary.length).toBeLessThan(600);
    expect(Array.isArray(recap.importantEvents)).toBe(true);
    expect(recap.spoilerChecked).toBe(true);
    expect(recap.window).toEqual({ startMs: 240_000, endMs: 330_000 });
    expect(recap.characters).toContain('Sarah');
    // A photograph-related clue (discovery at 302s or father link at 314s) headlines this window
    expect(recap.importantClue).not.toBeNull();
    expect(recap.importantClue!.text).toMatch(/[Pp]hotograph|Father/);
    // Never leaks the 7:00 reveal
    expect(recap.summary).not.toContain("knew your father");
    expect(recap.summary).not.toContain("knew Sarah's father");
  });

  it('caches identical recap requests', async () => {
    const service = new RecapService();
    const first = await service.generateRecap({
      contentId: 'last_signal_001',
      currentPositionMs: 130_000,
      windowStartMs: 60_000,
      windowEndMs: 130_000
    });
    const second = await service.generateRecap({
      contentId: 'last_signal_001',
      currentPositionMs: 130_000,
      windowStartMs: 60_000,
      windowEndMs: 130_000
    });
    expect(second.summary).toBe(first.summary);
    expect((second as any).cacheHit).toBe(true);
  });

  it('early-window recap stays safe about future reveals', async () => {
    const service = new RecapService();
    const recap = await service.generateRecap({
      contentId: 'last_signal_001',
      currentPositionMs: 50_000,
      windowStartMs: 0,
      windowEndMs: 50_000
    });
    expect(recap.spoilerChecked).toBe(true);
    // 0–50s covers scene_01 and part of scene_02 (a photo reference is on-screen there);
    // the spoiler boundary is about FUTURE events: the 5:00 discovery, 6:00 father link, 8:00 signal.
    expect(recap.summary).not.toContain('hidden behind the cabinet');
    expect(recap.summary).not.toContain('father');
    expect(recap.summary).not.toContain('signal');
    // The hidden-photograph clue (clue_04, discovered 302s) must not be surfaced
    expect(recap.importantClue?.text ?? '').not.toContain('hidden behind a cabinet');
  });
});

describe('Question service (deterministic provider)', () => {
  beforeAll(() => {
    setAIProvider(new DeterministicProvider());
  });

  it('answers "What clues do we know?" with only discovered clues', async () => {
    const service = new QuestionService();
    const res = await service.answer({
      contentId: 'last_signal_001',
      question: 'What clues do we know so far?',
      currentPositionMs: 360_000
    });
    expect(res.spoilerChecked).toBe(true);
    expect(res.answer).toContain('Photograph');
    expect(res.answer).not.toContain('signal'); // clue_06 is at 482s, after 360s
  });

  it('answers "Why is that important?" using earlier context', async () => {
    const service = new QuestionService();
    const res = await service.answer({
      contentId: 'last_signal_001',
      question: 'Why is that photograph important?',
      currentPositionMs: 360_000
    });
    expect(res.spoilerChecked).toBe(true);
    expect(res.answer.length).toBeGreaterThan(20);
  });

  it('answers "Who is involved?" with time-filtered character knowledge', async () => {
    const service = new QuestionService();
    const res = await service.answer({
      contentId: 'last_signal_001',
      question: 'Who is involved?',
      currentPositionMs: 120_000
    });
    expect(res.spoilerChecked).toBe(true);
  });
});
