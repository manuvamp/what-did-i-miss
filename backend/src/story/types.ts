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
  characters: string[];
  objects: string[];
  importance: number;
  spoilerBoundaryMs: number;
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
