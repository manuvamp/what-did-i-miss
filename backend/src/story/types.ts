// Shared story types

export interface SubtitleCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker?: string;
  sceneId?: string;
}

export interface Scene {
  id: string;
  startMs: number;
  endMs: number;
  title: string;
  summary: string;
  characters: string[];
  locations: string[];
  importantObjects: string[];
  events: string[];
  clues: string[];
  questionsRaised: string[];
  questionsResolved: string[];
}

export type EventType =
  | 'character_action'
  | 'dialogue'
  | 'clue'
  | 'reveal'
  | 'relationship_change'
  | 'object_change'
  | 'location_change';

export interface StoryEvent {
  id: string;
  timestampMs: number;
  type: EventType;
  description: string;
  /** Short narrative beat shown to viewers; `description` is the frame-level grounding. */
  story?: string;
  characters: string[];
  objects: string[];
  importance: number;
  spoilerBoundaryMs: number;
}

/**
 * Picks `count` beats that tell the story of [startMs, endMs]: the strongest
 * event in each equal slice of the window (so a 10-minute recap covers the
 * whole arc, not just its last big moment), topped up with the strongest of
 * the rest. Returned in story order.
 */
export function pickStoryBeats(
  events: StoryEvent[],
  startMs: number,
  endMs: number,
  count = 3
): StoryEvent[] {
  const byStrength = (a: StoryEvent, b: StoryEvent) =>
    b.importance - a.importance || b.timestampMs - a.timestampMs;
  const candidates = events.filter(e => e.importance >= 0.5).sort(byStrength);
  const picked: StoryEvent[] = [];
  const slice = Math.max(1, (endMs - startMs) / count);
  for (let i = 0; i < count; i++) {
    const lo = startMs + i * slice;
    const best = candidates.find(e => e.timestampMs >= lo && e.timestampMs < lo + slice);
    if (best) picked.push(best);
  }
  for (const e of candidates) {
    if (picked.length >= count) break;
    if (!picked.includes(e)) picked.push(e);
  }
  return picked.sort((a, b) => a.timestampMs - b.timestampMs);
}

/** The viewer-facing line for an event: its story beat when written, else its description. */
export function storyLine(e: StoryEvent): string {
  const text = e.story ?? e.description;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export interface Clue {
  id: string;
  title: string;
  description: string;
  discoveredAtMs: number;
  relatedCharacters: string[];
  relatedObjects: string[];
  status: 'unresolved' | 'partially_resolved' | 'resolved';
}

export interface KnownFactEntry {
  knownAtMs: number;
  fact: string;
}

export interface CharacterStateFile {
  name: string;
  firstAppearanceMs: number;
  lastAppearanceMs: number;
  relationships: string[];
  knownFacts: KnownFactEntry[];
  currentGoal?: string;
  currentLocation?: string;
}

export interface StoryObject {
  id: string;
  name: string;
  firstSeenMs: number;
  stateChanges: Array<{
    timestampMs: number;
    description: string;
  }>;
}

export interface TimestampedStoryState {
  atMs: number;
  currentCharacters: string[];
  knownFacts: string[];
  discoveredClues: string[];
  unresolvedQuestions: string[];
  importantObjects: string[];
  currentLocation?: string;
}

export interface StoryState {
  currentCharacters: CharacterStateFile[];
  relationships: Array<{
    characterA: string;
    characterB: string;
    type: string;
    establishedAtMs: number;
  }>;
  knownFacts: Array<{ id: string; description: string; knownAtMs: number }>;
  discoveredClues: Clue[];
  unresolvedQuestions: Array<{ id: string; question: string; raisedAtMs: number }>;
  importantObjects: StoryObject[];
  recentEvents: StoryEvent[];
}

export interface FrameReference {
  id: string;
  timestampMs: number;
  sceneId: string;
  path: string;
  description?: string;
}
