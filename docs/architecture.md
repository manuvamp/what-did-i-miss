# Architecture

## Overview

**What Did I Miss?** is a Fire TV application with a lightweight backend service. The Fire TV app owns playback, state tracking, and UI. The backend owns retrieval, context construction, AI reasoning, and response validation.

## Component Diagram

```
+----------------+        HTTP          +------------------+
|  Fire TV /     | <-----------------> |   Backend API    |
|  Android TV    |                     |   (TypeScript,   |
|  app (Kotlin)  |                     |    Express)      |
+----------------+                     +------------------+
       |                                        |
       v                                        v
+----------------+                     +------------------+
|  Media3/       |                     |  Story Engine    |
|  ExoPlayer     |                     |  (Retrieval)     |
+----------------+                     +------------------+
       |                                        |
       v                                        v
+----------------+                     +------------------+
|  HLS stream    |                     |  Content index   |
|  (served by    |                     |  (JSON files)    |
|  the backend)  |                     |                  |
+----------------+                     +------------------+

The demo runs over plain HTTP on a local network (the emulator reaches the host
as 10.0.2.2). HTTPS, S3 and CloudFront were considered and are not built.
```

## Key Design Decisions

### 1. Fire TV owns playback

The Fire TV app runs a full Media3/ExoPlayer stack. This gives us precise control over:
- playback position (polled every 500ms)
- seek detection
- subtitle track state
- MediaSession integration

### 2. Backend owns intelligence

The backend is stateless and lightweight. It queries a pre-built story index and constructs prompts for AI reasoning. No heavy models run on Fire TV.

### 3. Pre-built story index

All story intelligence is prepared offline (for Sintel, by hand from the extracted frames; see `content/sintel/ANALYSIS_NOTES.md`):
- scenes are segmented and summarized
- events carry timestamps, importance scores and a spoiler boundary, a visual `description` and a narrative `story` line
- clues are tracked with discovery timestamps
- characters, objects and story states are gated by when they become known
- subtitle cues are supported (parsed from WebVTT) but Sintel has none

### 4. Spoiler-safe by construction

Every retrieval query includes `maxTimestampMs = currentPlaybackPosition`. Records with `timestampMs > maxTimestampMs` are excluded. A final `SpoilerGuard` checks generated recaps and answers against later events and triggers a deterministic rewrite on a match.

### 5. Content is self-contained

v1 uses one controlled movie. This eliminates:
- DRM complexity
- cross-app subtitle access issues
- content ID mapping problems

## Data Flow

### Playback Loop

1. ExoPlayer plays the HLS stream, which the backend serves from `dist/hls/<name>/`
2. PlayerManager polls position every 500ms
3. PlaybackSnapshot is updated with current position, duration, content ID
4. MediaSession is updated for Fire TV remote/voice integration

### Recap Flow

1. User presses **WHAT DID I MISS?**
2. Player pauses
3. MissedRange is calculated: the last forward skip if it ended less than a minute ago, otherwise the last 5 minutes. The 2 / 5 / 0 keys ask for the last 2 / 5 / 10 minutes instead.
4. App sends `contentId + windowStart + windowEnd + currentPosition` to backend. `currentPosition` is the larger of the player snapshot position and the window end, because the backend rejects a position earlier than the window end.
5. Backend retrieves the current scene and the events, clues, characters, objects and story state up to `maxTimestampMs`
6. Backend retrieves relevant prior context (bounded by `maxTimestampMs`)
7. The configured provider (deterministic by default, or Anthropic / Bedrock) produces the recap from that structured context
8. SpoilerGuard checks the text against later events; on a hit the backend writes a deterministic recap instead. If the provider throws, the deterministic provider is used.
9. Backend attaches up to three key moments (story caption plus a frame URL) for the visual recap and returns the response
10. The app shows the text recap card, or plays the visual montage first if one was requested

If the backend cannot be reached the app shows a basic offline summary from the scene index bundled in the APK. It uses only scenes that finished inside the window plus the current scene's title, and does not go through SpoilerGuard.

## Schemas

### PlaybackSnapshot

```kotlin
data class PlaybackSnapshot(
    val contentId: String,
    val positionMs: Long,
    val durationMs: Long,
    val isPlaying: Boolean,
    val playbackSpeed: Float,
    val title: String
    // plus optional episodeId, seasonNumber, episodeNumber
)
```

### RetrievalContext

```typescript
interface RetrievalContext {
  contentId: string;
  startMs: number;
  endMs: number;
  maxTimestampMs: number; // spoiler boundary
}
```

### StoryEvent

```typescript
interface StoryEvent {
  id: string;
  timestampMs: number;
  type: 'character_action' | 'dialogue' | 'clue' | 'reveal'
      | 'relationship_change' | 'object_change' | 'location_change';
  description: string; // what is literally on screen
  story?: string;      // narrative beat shown to the viewer
  characters: string[];
  objects: string[];
  importance: number; // 0.0 - 1.0
  spoilerBoundaryMs: number;
}
```

## Performance Targets

These are design targets. They have not been measured.

| Metric | Target |
|--------|--------|
| Player controls | Instant |
| Recap overlay | < 300ms |
| Context retrieval | < 500ms |
| AI response | < 5s |
| Cached recap | < 500ms |

## Security

- No LLM API keys or AWS credentials in APK
- Backend reads credentials from environment variables
- Fire TV client receives only the API endpoint
- Request bodies are validated with Zod; recap and answer text is checked by SpoilerGuard
