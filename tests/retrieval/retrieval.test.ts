import { describe, it, expect } from 'vitest';
import { StoryEngine } from '../../backend/src/story/StoryEngine';

describe('Context retrieval', () => {
  const engine = new StoryEngine();
  const contentId = 'last_signal_001';

  it('retrieves only cues fully inside the window', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 0,
      endMs: 30_000,
      maxTimestampMs: 30_000
    });
    expect(ctx.subtitles.length).toBeGreaterThan(0);
    expect(ctx.subtitles.length).toBeLessThanOrEqual(4);
    for (const cue of ctx.subtitles) {
      expect(cue.startMs).toBeGreaterThanOrEqual(0);
      expect(cue.endMs).toBeLessThanOrEqual(30_000);
    }
  });

  it('identifies the correct current scene for a position', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 300_000,
      endMs: 350_000,
      maxTimestampMs: 350_000
    });
    expect(ctx.currentScene?.id).toBe('scene_07');
    expect(ctx.currentScene?.title).toBe('The Photograph');
  });

  it('retrieves events strictly within the window', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 300_000,
      endMs: 360_000,
      maxTimestampMs: 360_000
    });
    expect(ctx.events.length).toBeGreaterThan(0);
    for (const e of ctx.events) {
      expect(e.timestampMs).toBeGreaterThanOrEqual(300_000);
      expect(e.timestampMs).toBeLessThanOrEqual(360_000);
    }
  });

  it('returns all discovered clues up to position', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 300_000,
      endMs: 360_000,
      maxTimestampMs: 360_000
    });
    expect(ctx.clues.length).toBeGreaterThanOrEqual(5); // clues 1-5 by 360s
    for (const c of ctx.clues) {
      expect(c.discoveredAtMs).toBeLessThanOrEqual(360_000);
    }
  });

  it('collects characters from subtitles, events and the scene', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 300_000,
      endMs: 360_000,
      maxTimestampMs: 360_000
    });
    expect(ctx.characters).toContain('Sarah');
    expect(ctx.characters).toContain('Michael');
  });

  it('retrieves relevant prior context connecting to the current scene', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 300_000,
      endMs: 360_000,
      maxTimestampMs: 360_000
    });
    expect(ctx.priorContext.length).toBeGreaterThan(0);
    // Prior context should reference earlier building/photograph events
    expect(ctx.priorContext.join(' ')).toMatch(/building|photograph/i);
  });

  it('picks the correct timestamped story state', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 300_000,
      endMs: 360_000,
      maxTimestampMs: 360_000
    });
    expect(ctx.storyState).not.toBeNull();
    expect(ctx.storyState!.atMs).toBe(359_000);
    expect(ctx.storyState!.discoveredClues).toContain('clue_05');
  });

  it('selects frames near important window events', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 300_000,
      endMs: 360_000,
      maxTimestampMs: 360_000
    });
    expect(ctx.frames.length).toBeGreaterThan(0);
    expect(ctx.frames.length).toBeLessThanOrEqual(6);
    expect(ctx.frames.some(f => f.sceneId === 'scene_07')).toBe(true);
  });

  it('returns empty results gracefully for a position before any content', async () => {
    const ctx = await engine.retrieveContext({
      contentId,
      startMs: 0,
      endMs: 1_000,
      maxTimestampMs: 1_000
    });
    expect(ctx.subtitles).toEqual([]);
    expect(ctx.events).toEqual([]);
    expect(ctx.currentScene).not.toBeNull(); // scene_01 covers 0-29s
  });
});
