# AI System

## Philosophy

The AI is never given a raw transcript and asked to summarize. It receives structured, timestamped, spoiler-filtered context.

## Prompt Structure

```
CURRENT PLAYBACK POSITION:
42:37

MISSED WINDOW:
37:37 → 42:37

CURRENT SCENE:
Scene 8 — The Basement

IMMEDIATE EVENTS:
- Sarah followed Michael into the basement.
- Michael opened the old cabinet.
- Sarah found a photograph.

RELEVANT PREVIOUS CONTEXT:
- In Scene 3, Sarah learned that the old building belonged to her father.
- Michael previously claimed he had never visited the building.

CURRENT STORY STATE:
- Photograph: discovered
- Michael's involvement: unresolved
- Sarah's objective: identify who sent the anonymous message

VISUAL EVIDENCE:
Frame 1...
Frame 2...
Frame 3...

STRICT RULE:
Do not mention, infer, or reveal events after 42:37.
```

## Response Schema

The AI must return structured JSON conforming to:

```typescript
interface RecapResponse {
  window: { startMs: number; endMs: number };
  summary: string;
  importantEvents: string[];
  importantClue: { text: string; confidence: number } | null;
  relevantEarlierContext: string[];
  characters: string[];
  spoilerChecked: boolean;
}
```

## Spoiler Guard

Two layers of protection:

1. **Retrieval filtering** — every query includes `maxTimestampMs`. Future records are excluded before reaching the model.

2. **Response validation** — generated text is checked against allowed events. If a future event is referenced, the response is rejected and regenerated.

## Provider Abstraction

The AI layer uses a provider interface:

```typescript
interface AIProvider {
  generateRecap(context: StructuredContext): Promise<RecapResponse>;
  answerQuestion(question: string, context: StructuredContext): Promise<QuestionResponse>;
}
```

Implementations:
- `BedrockProvider` — Amazon Bedrock (Claude, Titan)
- `MockProvider` — deterministic fallback for testing
- `LocalProvider` — small local model (future)

## Intent Model

```typescript
type ViewerIntent =
  | { type: 'recap'; positionMs: number }
  | { type: 'explain'; question: string; positionMs: number }
  | { type: 'characters'; positionMs: number }
  | { type: 'clues'; positionMs: number }
  | { type: 'resume' };
```

## Recap vs. Explanation

- **Recap** ("What did I miss?") focuses on events.
- **Explanation** ("Why is that important?") focuses on causal context and earlier story state.

The same retrieval engine serves both, but the prompt construction differs.

## Fallback

If the AI server is unavailable:
- retrieve subtitle cues
- retrieve scene summary
- display deterministic recap

The product should not completely fail.
