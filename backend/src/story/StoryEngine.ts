import fs from 'fs';
import path from 'path';
import { config } from '../config';
import {
  SubtitleCue,
  Scene,
  StoryEvent,
  Clue,
  CharacterStateFile,
  StoryObject,
  TimestampedStoryState
} from './types';

export interface RetrievalContext {
  contentId: string;
  startMs: number;
  endMs: number;
  maxTimestampMs: number;
}

export interface RetrievedContext {
  subtitles: SubtitleCue[];
  currentScene: Scene | null;
  events: StoryEvent[];
  clues: Clue[];
  priorContext: string[];
  characters: string[];
  characterStates: CharacterStateFile[];
  objects: StoryObject[];
  storyState: TimestampedStoryState | null;
  frames: FrameRef[];
}

interface FrameRef {
  id: string;
  timestampMs: number;
  sceneId: string;
  path: string;
  description?: string;
}

interface ClueIndexEntry {
  title: string;
  relatedCharacters: string[];
  relatedObjects: string[];
}

/**
 * Resolves a contentId (e.g. "last_signal_001") to its content directory
 * slug (e.g. "last-signal"): strip trailing _NNN version, underscores → dashes.
 */
export function contentSlug(contentId: string): string {
  return contentId.replace(/_\d+$/, '').replace(/_/g, '-');
}

export class StoryEngine {
  private cache = new Map<string, ContentIndex>();

  private load(contentId: string): ContentIndex {
    const existing = this.cache.get(contentId);
    if (existing) return existing;

    const dir = path.join(config.contentDir, contentSlug(contentId));
    const read = <T>(file: string, fallback: T): T => {
      const p = path.join(dir, file);
      if (!fs.existsSync(p)) return fallback;
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
      } catch {
        return fallback;
      }
    };

    const storyStateRaw = read<{ states: TimestampedStoryState[] }>('story-state.json', { states: [] });

    const index: ContentIndex = {
      subtitles: read<SubtitleCue[]>('subtitles.json', []),
      scenes: read<Scene[]>('scenes.json', []),
      events: read<StoryEvent[]>('events.json', []),
      clues: read<Clue[]>('clues.json', []),
      characters: read<CharacterStateFile[]>('characters.json', []),
      objects: read<StoryObject[]>('objects.json', []),
      storyStates: storyStateRaw.states ?? [],
      frames: read<FrameRef[]>('frames.json', [])
    };

    this.cache.set(contentId, index);
    return index;
  }

  async retrieveContext(params: RetrievalContext): Promise<RetrievedContext> {
    const { contentId, startMs, endMs, maxTimestampMs } = params;
    const idx = this.load(contentId);

    // Spoiler guard: never retrieve anything beyond maxTimestampMs
    const effectiveEnd = Math.min(endMs, maxTimestampMs);

    const subtitles = idx.subtitles.filter(
      c => c.endMs > startMs && c.startMs < effectiveEnd && c.endMs <= maxTimestampMs
    );

    const currentScene =
      idx.scenes.find(s => s.startMs <= maxTimestampMs && s.endMs >= maxTimestampMs) ?? null;

    const events = idx.events.filter(
      e =>
        e.timestampMs >= startMs &&
        e.timestampMs <= effectiveEnd &&
        (e.spoilerBoundaryMs ?? e.timestampMs) <= maxTimestampMs
    );

    const clues = idx.clues.filter(c => c.discoveredAtMs <= maxTimestampMs);

    // Characters from window subtitles/events/scene, in stable order
    const characterSet = new Set<string>();
    subtitles.forEach(s => s.speaker && characterSet.add(s.speaker));
    events.forEach(e => e.characters.forEach(c => characterSet.add(c)));
    if (currentScene) currentScene.characters.forEach(c => characterSet.add(c));

    const characterStates = idx.characters
      .filter(c => c.firstAppearanceMs <= maxTimestampMs)
      .map(c => ({
        ...c,
        knownFacts: c.knownFacts.filter(f => f.knownAtMs <= maxTimestampMs),
        lastAppearanceMs: Math.min(c.lastAppearanceMs, maxTimestampMs)
      }));

    const objects = idx.objects
      .filter(o => o.firstSeenMs <= maxTimestampMs)
      .map(o => ({
        ...o,
        stateChanges: o.stateChanges.filter(sc => sc.timestampMs <= maxTimestampMs)
      }));

    // Story state: latest state at or before maxTimestampMs
    const storyState =
      [...idx.storyStates]
        .filter(s => s.atMs <= maxTimestampMs)
        .sort((a, b) => b.atMs - a.atMs)[0] ?? null;

    const frames = this.selectFrames(idx, currentScene, events, maxTimestampMs);

    const priorContext = this.retrievePriorContext(idx, currentScene, events, maxTimestampMs);

    return {
      subtitles,
      currentScene,
      events,
      clues,
      priorContext,
      characters: Array.from(characterSet),
      characterStates,
      objects,
      storyState,
      frames
    };
  }

  /**
   * Context for question answering: a wide lookback across everything
   * knowable up to the current position.
   */
  async retrieveQuestionContext(contentId: string, positionMs: number): Promise<RetrievedContext> {
    return this.retrieveContext({
      contentId,
      startMs: Math.max(0, positionMs - 30 * 60 * 1000),
      endMs: positionMs,
      maxTimestampMs: positionMs
    });
  }

  /**
   * Earlier events related to the current scene — ranked deterministically.
   */
  private retrievePriorContext(
    idx: ContentIndex,
    currentScene: Scene | null,
    windowEvents: StoryEvent[],
    maxTimestampMs: number
  ): string[] {
    if (!currentScene) return [];
    const windowEventIds = new Set(windowEvents.map(e => e.id));

    // Expand the scene's characters through the static relationship graph so
    // that e.g. the fight with the "Adult Dragon" can link back to earlier
    // scenes featuring "Scales" (both relate to Sintel). Relationships are
    // static metadata, not future events, so this does not leak spoilers.
    const sceneChars = new Set(currentScene.characters);
    for (const name of [...sceneChars]) {
      const ch = idx.characters.find(c => c.name === name);
      if (ch) ch.relationships.forEach(r => sceneChars.add(r));
    }
    const sceneObjects = new Set(currentScene.importantObjects);

    const ranked = idx.events
      .filter(e => e.timestampMs < currentScene.startMs)
      .filter(e => !windowEventIds.has(e.id))
      .filter(e => (e.spoilerBoundaryMs ?? e.timestampMs) <= maxTimestampMs)
      .map(e => {
        const charOverlap = e.characters.filter(c => sceneChars.has(c)).length;
        const objOverlap = e.objects.filter(o => sceneObjects.has(o)).length;
        // Character/object relevance dominates; recency is a weak tiebreak so
        // that the semantically important early link (e.g. the Scales bond)
        // is not buried by merely-recent events.
        const score =
          charOverlap * 0.45 + objOverlap * 0.3 + e.importance * 0.2 +
          recencyScore(e.timestampMs, currentScene.startMs) * 0.05;
        return { e, score };
      })
      .filter(r => r.score > 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(r => `In ${sceneTitleFor(idx, r.e.id, r.e.timestampMs)}, ${lowerFirst(r.e.description)}`);

    return ranked;
  }

  private selectFrames(
    idx: ContentIndex,
    currentScene: Scene | null,
    events: StoryEvent[],
    maxTimestampMs: number
  ): FrameRef[] {
    const eligible = idx.frames.filter(f => f.timestampMs <= maxTimestampMs);
    const picked: FrameRef[] = [];

    // Frames nearest to the most important events in the window
    const importantEvents = [...events].sort((a, b) => b.importance - a.importance).slice(0, 3);
    for (const event of importantEvents) {
      const nearest = nearestFrame(eligible, event.timestampMs, picked);
      if (nearest) picked.push(nearest);
    }

    // Fill with current-scene frames if fewer than 3
    if (currentScene && picked.length < 3) {
      for (const f of eligible.filter(f => f.sceneId === currentScene.id)) {
        if (picked.length >= 3) break;
        if (!picked.some(p => p.id === f.id)) picked.push(f);
      }
    }

    return picked.slice(0, 6);
  }

  getMetadata(contentId: string): any | null {
    const dir = path.join(config.contentDir, contentSlug(contentId));
    const p = path.join(dir, 'metadata.json');
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return null;
    }
  }

  listContent(): any[] {
    if (!fs.existsSync(config.contentDir)) return [];
    return fs
      .readdirSync(config.contentDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const meta = this.getMetadata(`${d.name.replace(/-/g, '_')}_001`);
        return meta;
      })
      .filter(Boolean);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

interface ContentIndex {
  subtitles: SubtitleCue[];
  scenes: Scene[];
  events: StoryEvent[];
  clues: Clue[];
  characters: CharacterStateFile[];
  objects: StoryObject[];
  storyStates: TimestampedStoryState[];
  frames: { id: string; timestampMs: number; sceneId: string; path: string; description?: string }[];
}

function recencyScore(eventMs: number, referenceMs: number): number {
  const span = Math.max(1, referenceMs);
  return Math.max(0, 1 - (referenceMs - eventMs) / span);
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function sceneTitleFor(idx: ContentIndex, _eventId: string, timestampMs: number): string {
  const scene = idx.scenes.find(s => s.startMs <= timestampMs && s.endMs >= timestampMs);
  return scene ? scene.title : 'earlier';
}

function nearestFrame<T extends { id: string }>(
  candidates: { id: string; timestampMs: number }[],
  targetMs: number,
  alreadyPicked: T[]
): any | null {
  let best: any = null;
  let bestDist = Infinity;
  for (const f of candidates) {
    if (alreadyPicked.some(p => p.id === f.id)) continue;
    const d = Math.abs(f.timestampMs - targetMs);
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}
