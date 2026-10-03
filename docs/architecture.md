# Architecture

## Overview

**What Did I Miss?** is a Fire TV application with a lightweight backend service. The Fire TV app owns playback, state tracking, and UI. The backend owns retrieval, context construction, AI reasoning, and response validation.

## Component Diagram

```
+----------------+        HTTPS         +------------------+
|   Fire TV App  | <-----------------> |   Backend API    |
|   (Kotlin)     |                     |   (TypeScript)   |
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
|  HLS Stream    |                     |  Content Index   |
|  (CloudFront)  |                     |  (JSON/SQLite)   |
+----------------+                     +------------------+
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

All story intelligence is computed offline:
- subtitle cues are parsed from WebVTT
- scenes are segmented and summarized
- events are extracted with timestamps and importance scores
- clues are tracked with discovery timestamps
- story states are snapshotted at key points

### 4. Spoiler-safe by construction

Every retrieval query includes `maxTimestampMs = currentPlaybackPosition`. Records with `timestampMs > maxTimestampMs` are excluded. A final `SpoilerGuard` validates all generated responses against allowed events.

### 5. Content is self-contained

v1 uses one controlled movie. This eliminates:
- DRM complexity
- cross-app subtitle access issues
- content ID mapping problems

## Data Flow

### Playback Loop

1. ExoPlayer plays HLS stream from CloudFront
2. PlayerManager polls position every 500ms
3. PlaybackSnapshot is updated with current position, duration, content ID
4. MediaSession is updated for Fire TV remote/voice integration

### Recap Flow

1. User presses **WHAT DID I MISS?**
2. Player pauses
3. MissedRange is calculated (default: last 5 minutes, or forward-seek gap)
4. App sends `contentId + windowStart + windowEnd + currentPosition` to backend
5. Backend retrieves subtitles, current scene, events, clues within window
6. Backend retrieves relevant prior context (bounded by `maxTimestampMs`)
7. Backend constructs structured prompt
8. LLM generates JSON response
9. Backend validates response against schema + spoiler guard
10. Backend returns recap to Fire TV
11. Fire TV displays overlay

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
  type: 'character_action' | 'dialogue' | 'clue' | 'reveal';
  description: string;
  characters: string[];
  objects: string[];
  importance: number; // 0.0 - 1.0
  spoilerBoundaryMs: number;
}
```

## Performance Targets

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
- All AI responses validated against Zod schemas
