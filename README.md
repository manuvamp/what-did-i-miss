# What Did I Miss?

A Fire TV AI contextual viewing assistant.

## Credits

Demo film: **Sintel** (c) Blender Foundation | durian.blender.org, licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
This project is **not endorsed by or affiliated with Blender**. The story index for Sintel (scenes, events, clues) was produced by the project team from the film and is provided for demonstration.

## Problem

People lose track of movies and shows. They check their phone, get interrupted, or simply forget what happened. When they return, they are lost.

## Solution

**What Did I Miss?** is a Fire TV experience that reconstructs the context the viewer missed. It understands:

- exactly what content is playing
- exactly where the viewer is in the timeline
- what was said during the relevant section
- what happened in the current scene
- which earlier story information is relevant
- what characters, objects, clues, and events matter

It never reveals future events. The system behaves like a story-aware memory for television.

## Features

- **Timestamp-aware recap** — knows exactly where you are
- **Spoiler-safe story memory** — never leaks future events
- **Subtitle-aware retrieval** — uses dialogue as data
- **Scene understanding** — connects what happened to where it happened
- **Character/context memory** — tracks who knows what, when
- **Visual context** — uses keyframes for richer understanding
- **Exact missed-range replay** — jump back to the exact moment you missed

## Architecture

```
                         FIRE TV
                            |
                            v
                +----------------------+
                |  WHAT DID I MISS?    |
                |   Fire TV Android    |
                |        App           |
                +----------+-----------+
                           |
                  Media3 / ExoPlayer
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
          Video         Subtitles     Metadata
             |             |             |
             +-------------+-------------+
                           v
                    Playback State
               position / duration / ID
                           |
                           v
                  Context Retrieval
                           |
        +------------------+------------------+
        v                  v                  v
  subtitle index     scene index        story state
        |                |                  |
        +----------------+------------------+
                           v
                     AI Reasoning
                           |
                  +--------+---------+
                  v                  v
              recap              questions
                  |                  |
                  +--------+---------+
                           v
                    Fire TV overlay
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Fire TV App | Kotlin, Android, Media3, ExoPlayer, MediaSession |
| Video | HLS, WebVTT, AWS S3, CloudFront |
| Context | SQLite, FTS5, JSON story index |
| AI | Provider abstraction, Amazon Bedrock (optional) |
| Processing | Node/TypeScript, Python, ffmpeg |
| UI | Native Fire TV UI, Remote-first, Cinematic overlay |

## Setup

### Prerequisites

- Android Studio
- Fire TV device or simulator
- Node.js 20+
- AWS account (for S3/CloudFront)

### Fire TV App

```bash
cd app
./gradlew assembleDebug
```

Install via ADB:

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Backend

```bash
cd backend
npm install
npm run dev
```

### Content Pipeline

```bash
# Ingest subtitles
npm run ingest:subtitles -- scripts/movie.vtt content/last-signal/subtitles.json

# Validate content
npm run validate:content -- content/last-signal

# Extract frames (requires ffmpeg)
npx ts-node scripts/extract_frames.ts movie.mp4 content/last-signal/frames 12

# Package video for HLS (requires ffmpeg)
./scripts/package_video.sh movie.mp4 dist/hls last_signal
```

## Demo Content

The demo movie **The Last Signal** is a 9-minute mystery thriller designed to showcase the product:

- 10 scenes
- 2 main characters (Sarah, Michael)
- 6 clues
- Photograph, key, cabinet as important objects
- Anonymous message mystery
- Basement discovery sequence

### Demo Timeline

| Time | Event |
|------|-------|
| 00:00 | Sarah receives anonymous message |
| 00:30 | Michael denies knowing the building |
| 01:00 | Sarah discovers missing key |
| 02:00 | Michael enters basement |
| 03:00 | Sarah follows him |
| 04:00 | Cabinet opened |
| 05:00 | Photograph discovered |
| 06:00 | Sarah realizes photograph's significance |
| 07:00 | Michael reveals connection |
| 08:00 | Active signal discovered |

## Product Feedback

See `docs/product-feedback.md` for actual feedback on Fire TV, Media3, and AWS services used.

## Friction Log

See `docs/friction-log.md` for real problems encountered during development.

## License

MIT — see `LICENSE` file.

---

> **What Did I Miss?** is a Fire TV viewing assistant that understands where you are in a story, reconstructs what happened around you, connects it to earlier context, and explains it without spoiling what comes next.
