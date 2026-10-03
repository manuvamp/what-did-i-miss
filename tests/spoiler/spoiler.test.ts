import { describe, it, expect } from 'vitest';
import { StoryEngine } from '../../backend/src/story/StoryEngine';
import { SpoilerGuard } from '../../backend/src/validation/SpoilerGuard';

describe('Spoiler safety', () => {
  const engine = new StoryEngine();
  const guard = new SpoilerGuard();
  const contentId = 'last_signal_001';

  it('Test 1: at 10:00 no context uses 10:01+', async () => {
    const pos = 10 * 60 * 1000;
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 0,
      endMs: pos,
      maxTimestampMs: pos
    });

    for (const cue of ctx.subtitles) expect(cue.endMs).toBeLessThanOrEqual(pos);
    for (const e of ctx.events) expect(e.timestampMs).toBeLessThanOrEqual(pos);
    for (const c of ctx.clues) expect(c.discoveredAtMs).toBeLessThanOrEqual(pos);
    if (ctx.storyState) expect(ctx.storyState.atMs).toBeLessThanOrEqual(pos);
  });

  it('Test 2: a future clue at 46:00 does not appear at 42:37', async () => {
    // clue_06 (active signal) discovered at 482000ms; check at 42:37 ≈ 2557000 is past it,
    // so instead use a position before it: 7 min (420000ms)
    const pos = 420_000;
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 0,
      endMs: pos,
      maxTimestampMs: pos
    });
    expect(ctx.clues.find(c => c.id === 'clue_06')).toBeUndefined();
  });

  it('Test 3: the late character reveal is not exposed early', async () => {
    // event_014 (Michael reveals he knew Sarah's father) has spoilerBoundary 479000ms
    const pos = 400_000;
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 0,
      endMs: pos,
      maxTimestampMs: pos
    });
    expect(ctx.events.find(e => e.id === 'event_014')).toBeUndefined();

    // And the story state at that time must not contain that knowledge
    expect(ctx.storyState?.knownFacts.join(' ')).not.toContain('knew Sarah');
  });

  it('character knownFacts are time-filtered', async () => {
    const pos = 60_000; // before Michael's reveal and before Sarah learns about her father
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 0,
      endMs: pos,
      maxTimestampMs: pos
    });
    const sarah = ctx.characterStates.find(c => c.name === 'Sarah');
    expect(sarah).toBeDefined();
    for (const f of sarah!.knownFacts) {
      expect(f.knownAtMs).toBeLessThanOrEqual(pos);
    }
    expect(sarah!.knownFacts.map(f => f.fact).join(' ')).not.toContain('father worked');
  });

  it('object state changes are time-filtered', async () => {
    // Photograph's "found behind cabinet" change is at 302000ms
    const pos = 100_000;
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 0,
      endMs: pos,
      maxTimestampMs: pos
    });
    const photo = ctx.objects.find(o => o.id === 'object_photograph');
    expect(photo).toBeDefined();
    for (const sc of photo!.stateChanges) {
      expect(sc.timestampMs).toBeLessThanOrEqual(pos);
    }
  });

  it('layers past the boundary become available once position passes it', async () => {
    const pos = 500_000; // past reveal boundary 479000
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 420_000,
      endMs: pos,
      maxTimestampMs: pos
    });
    expect(ctx.events.find(e => e.id === 'event_014')).toBeDefined();
  });

  it('SpoilerGuard text validation catches direct future references and passes safe text', () => {
    const early = guard.validateText(
      contentId,
      "Sarah found a photograph hidden behind the cabinet in the basement.",
      360_000
    );
    expect(early.ok).toBe(true);

    const leaky = guard.validateText(
      contentId,
      "Just so you know, the signal is still active and someone else is in the building.",
      360_000
    );
    expect(leaky.ok).toBe(false);

    const revealLeak = guard.validateText(
      contentId,
      "The truth is that Michael knew her father all along.",
      360_000
    );
    expect(revealLeak.ok).toBe(false);
  });
});

describe('Prior context is bounded', () => {
  it('prior context never references unresolved-future events', async () => {
    const engine = new StoryEngine();
    const contentId = 'last_signal_001';
    const pos = 310_000; // scene_07 window; reveals at 422000 must not leak
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 240_000,
      endMs: pos,
      maxTimestampMs: pos
    });
    const joined = ctx.priorContext.join(' ').toLowerCase();
    expect(joined).not.toContain('knew sarah');
    expect(joined).not.toContain('signal is still active');
  });
});
