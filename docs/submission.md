# Hackathon Submission — What Did I Miss?

## Problem

People lose track of movies and shows. You check your phone, get interrupted, or skip ahead — and suddenly you're lost. A summary that ignores where you actually are in the story can easily spoil what comes next.

## Solution

**What Did I Miss?** is an AI viewing assistant for Android TV / Fire TV that answers one question with total precision: *what did I just miss?* Press one button on the remote and you get a spoiler-safe recap of exactly the part you missed, connected to the earlier story context that makes it make sense.

It is not "summarize the last five minutes of subtitles." It is a **story-aware memory for television**: it knows the scene you're in, the events that happened, the clues you've seen, the characters present — and, critically, **what it is allowed to tell you** at your exact timestamp.

## How it uses Fire TV / Android TV

- **Media3 / ExoPlayer** HLS playback. (The demo film has no dialogue, so subtitles are not exercised.)
- **MediaSession** publishing correct playback state and transport controls (play / pause / rewind / fast-forward / seek) so the TV remote and system UI work.
- Continuous playback-position tracking drives every answer, and forward skips (including repeated FF presses, merged into one skip) are detected so the recap can cover exactly what was skipped.
- Remote-first UI: one D-pad-reachable button, a visual recap of the last 2 / 5 / 10 minutes (up to three key moments with real film frames), question "chips" selectable with the D-pad (no voice dependency), BACK to dismiss.
- Runs on the Android TV emulator `tv1080` (API 33, x86). It has not been run on a physical Fire TV yet; the same APK is meant to run on Fire OS (Fire TV is Android-based), and the RUNBOOK lists the steps.

## Spoiler safety — the core differentiator

Two independent layers:

1. **Layer-1 retrieval filter.** Every record (subtitles, events, clues, story states, frames, character facts) is timestamped, and every retrieval query is bounded by `maxTimestampMs = currentPosition`. Anything later simply does not exist in the context handed to the answerer.
2. **Layer-2 SpoilerGuard.** Before any text reaches the viewer, a validator checks it against future events by matching distinctive word-pairs; phrases already legitimately disclosed are exempt. A leak triggers a deterministic rewrite.

A **deterministic provider** produces the recap from the story index with no model at all — so the app works offline and the spoiler logic is regression-testable. An LLM provider (Anthropic / Amazon Bedrock) can be swapped in behind the same interface.

## Tech stack

| Layer | Tech |
|-------|------|
| TV app | Kotlin, Android, Media3 ExoPlayer, MediaSessionCompat, XML + ViewBinding |
| Video | HLS (ffmpeg-packaged), served by the backend over local HTTP; no CDN |
| Context | Pre-built JSON story index (scenes, events, clues, characters, objects, story states, frames) |
| Backend | TypeScript / Express, Zod validation, in-memory recap cache |
| AI | Provider abstraction: deterministic (default), Anthropic, Amazon Bedrock |
| Demo film | **Sintel** — Blender Foundation open movie, CC BY 3.0 |

## What is real vs placeholder (honest)

- **Real:** the spoiler-safe recap pipeline, retrieval engine, SpoilerGuard, clue listing, deterministic provider, HLS delivery by the backend, the visual recap, skip detection, and 30 automated backend tests (all passing; 7 of them cover the Sintel index, the rest use a small fictional fixture). The Android app compiles and runs on the Android TV emulator.
- **Real content:** Sintel (CC BY 3.0) with a hand-built index of 16 scenes, 28 events and 7 clues (plus 6 characters, 7 objects, 12 story states, 238 frames). All 28 events were checked against independent ffmpeg frames. This index is the second version: the first was partly invented (a forge, sword and map that are not in the film) and was rebuilt from the frames on 2026-10-14. Earlier, a real Layer-1 leak was caught and fixed: a scene summary and a clue were narrating the twist before its boundary.
- **Not done / limits:** no run on a physical Fire TV stick (emulator only, with a 720p Main-profile copy of the film because the emulator's decoder crashes on the 1080p stream). The Anthropic and Bedrock providers are wired but have not been run with live keys. No S3 or CloudFront; video is served by the backend.

## Why it matters

The twist in Sintel — the final dragon is the baby dragon Scales she once loved — is exactly the kind of moment a naive "recap" would spoil. This product proves a TV assistant can be genuinely helpful *and* genuinely spoiler-safe, by treating time as a first-class constraint.
