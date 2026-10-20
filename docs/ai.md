# AI System

## Philosophy

The AI is never given a raw transcript and asked to summarize. It receives structured, timestamped, spoiler-filtered context. The default provider does not use a model at all.

## Prompt Structure

`backend/src/llm/promptBuilder.ts` builds the prompt for the Anthropic and Bedrock providers. An example at 10:15 into Sintel with a 2-minute window (shortened):

```
CURRENT PLAYBACK POSITION:
10:15

MISSED WINDOW:
8:15 → 10:15

CURRENT SCENE:
Recognition and Grief
<scene summary>

IMMEDIATE EVENTS:
- <frame-level description of each event in the window that is safe to mention>

RELEVANT PREVIOUS CONTEXT:
- <earlier story facts, bounded by the position>

CURRENT STORY STATE:
- Clues known: ...
- Unresolved questions: ...
- Known facts: ...

CHARACTERS PRESENT:
Sintel, Adult Dragon

STRICT RULES:
1. Do not mention, infer, or hint at any events after 10:15.
...
```

The prompt also has a `DIALOGUE IN WINDOW` section when subtitle cues exist. Sintel has none, so it is omitted. The Sintel data in the example is illustrative; the real text comes from `content/sintel/`.

## Response Schema

The recap provider returns JSON with:

```typescript
interface RecapResponse {
  window: { startMs: number; endMs: number };
  summary: string;
  importantEvents: string[];
  importantClue: { text: string; confidence: number } | null;
  relevantEarlierContext: string[];
  characters: string[];
  spoilerChecked: boolean;
  highlights?: { timestampMs: number; sceneTitle: string; caption: string; frameUrl: string | null }[];
}
```

`characters` and `highlights` are filled in by the backend from retrieval, never by the model, so a model cannot invent a name or a frame. `window` and `spoilerChecked` are also set by the backend.

## Spoiler Guard

Two layers of protection:

1. **Retrieval filtering.** Every query includes `maxTimestampMs`. Events, clues, character facts, object changes, story states and frames after it are excluded before reaching the model. Events also have a `spoilerBoundaryMs`; one is only used once the position has passed it.
2. **Response validation.** `SpoilerGuard` takes each event that happens after the viewer's position, builds word pairs from its description (consecutive significant words and skip-one pairs), and flags the generated text if both words of a pair appear within three words of each other. Pairs that also appear in clues the viewer has already discovered are exempt. On a hit, the backend discards the text and writes a deterministic recap from the allowed events. Question answers get the same check.

Limits to know about:

- The check is word-pair matching, not understanding. It catches distinctive phrases from a later event; it can miss a spoiler that is paraphrased, and it can flag an innocent sentence that happens to share a pair.
- The prompt gives only the *title* of the scene in progress, not its summary, because a scene can run past the playhead (scene 15 of Sintel starts at 10:05 and its summary states the twist, which unlocks at 10:22). What has happened so far comes from time-gated events.

## Provider Abstraction

```typescript
interface AIProvider {
  readonly name: string;
  generateRecap(context: StructuredContext): Promise<RecapResponse>;
  answerQuestion(question: string, context: StructuredContext): Promise<QuestionResponse>;
}
```

Selected by `AI_PROVIDER`:

| Value | Provider | Notes |
|-------|----------|-------|
| `deterministic` (default; `mock` is an alias) | `DeterministicProvider` | Builds recaps and answers from the story index. No keys, fully testable. |
| `anthropic` | `AnthropicProvider` | Calls the Messages API with `ANTHROPIC_API_KEY`; model from `ANTHROPIC_MODEL`. |
| `bedrock` | `BedrockProvider` | Amazon Bedrock; `AWS_REGION`, `BEDROCK_MODEL_ID`, AWS credentials. |

The Anthropic and Bedrock providers have not been run against live keys in this repo. There is no OpenAI provider, local-model provider or other implementation, although `.env.example` and `backend/src/config.ts` mention an `openai` option. Setting `AI_PROVIDER=openai` silently falls back to the deterministic provider.

## Recap vs. Explanation

- **Recap** ("What did I miss?" and the 2 / 5 / 10 minute keys) focuses on events in the window.
- **Explanation** (the follow-up chips: *Why is that important?*, *What clues do we know?*, *Who is involved?*, *What happened earlier?*) uses a wider look-back over everything knowable up to the current position, and the question prompt differs from the recap prompt.

Both use the same retrieval engine and the same SpoilerGuard.

## Choosing recap beats

For a window, the backend picks up to three events with importance 0.5 or more, taking the strongest one in each third of the window, so a 10-minute recap covers the arc rather than only its last big moment. Each event has a narrative `story` line (shown to the viewer) next to a frame-level `description` (used for grounding).

## Fallback

- If the AI provider throws, the backend returns a deterministic recap.
- If the backend cannot be reached, the app shows a basic offline summary from the scene index bundled in the APK. It uses only scenes that already finished plus the current scene's title, but does not go through SpoilerGuard.
