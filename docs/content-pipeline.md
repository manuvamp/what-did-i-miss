# Content Pipeline

## Overview

The content pipeline transforms a source video into a structured story index that the runtime system can query. This happens offline, before playback.

## Pipeline Stages

```
original video
      |
      v
extract metadata
      |
      v
extract / validate subtitles
      |
      v
segment scenes
      |
      v
extract keyframes
      |
      v
generate scene summaries
      |
      v
extract entities
      |
      v
extract events
      |
      v
build story states
      |
      v
build indexes
      |
      v
validate everything
      |
      v
production dataset
```

## Output Structure

```
content/
  last-signal/
      metadata.json
      subtitles.json
      scenes.json
      events.json
      clues.json
      story-state.json
      frames.json
      frames/
        scene_01/
          frame_001.jpg
          ...
```

## 1. Metadata

`metadata.json` contains basic content information:

```json
{
  "contentId": "last_signal_001",
  "title": "The Last Signal",
  "type": "movie",
  "durationMs": 1080000,
  "language": "en"
}
```

## 2. Subtitles

Subtitles are parsed from WebVTT using `scripts/ingest_subtitles.ts`. The parser:

- parses timestamps
- normalizes formatting
- merges consecutive tiny cues from same speaker
- preserves speaker metadata
- removes formatting tags
- maps cues to scenes

No LLM is used for parsing — this is deterministic.

## 3. Scenes

Scenes are segmented using a combination of:
- shot changes (ffmpeg scene detection)
- subtitle pauses
- dialogue transitions
- manual verification

Each scene has:
- start/end timestamps
- title and summary
- characters present
- locations
- important objects
- events
- clues
- questions raised/resolved

## 4. Events

Events are the atomic units of story. Each event has:
- timestamp
- type (dialogue, action, clue, reveal, etc.)
- description
- characters involved
- objects involved
- importance score (0.0–1.0)
- spoiler boundary (when it becomes safe to mention)

## 5. Clues

Clues track mystery elements:
- when they were discovered
- related characters and objects
- resolution status

## 6. Frames

Keyframes are extracted with ffmpeg:
- 1 frame every 10–15 seconds
- additional frames at shot changes
- manual important frames

Only 3–6 frames are sent to the AI per request.

## 7. Validation

Run `npm run validate:content` to check:
- all required fields present
- timestamps are valid (no overlaps, no negatives)
- cross-references exist (scene IDs, character names)
- no future leakage in timestamp assignments

## Quality Over Automation

For the hackathon movie, manual correction of scenes and events is allowed and encouraged. The goal is a perfect story index, not a fully automated pipeline.
