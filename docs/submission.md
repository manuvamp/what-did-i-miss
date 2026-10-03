# Hackathon Submission — What Did I Miss?

## Problem

People lose track of movies and shows. You check your phone, get interrupted, or skip ahead — and suddenly you're lost. Existing "summary" features either spoil upcoming plot or ignore where you actually are in the story.

## Solution

**What Did I Miss?** is an AI viewing assistant for Android TV / Fire TV that answers one question with total precision: *what did I just miss?* Press one button on the remote and, a second later, you get a spoiler-safe recap of exactly the part you missed, connected to the earlier story context that makes it make sense.

It is not "summarize the last five minutes of subtitles." It is a **story-aware memory for television**: it knows the scene you're in, the events that happened, the clues you've seen, the characters present — and, critically, **what it is allowed to tell you** at your exact timestamp.

## How it uses Fire TV / Android TV

- **Media3 / ExoPlayer** HLS playback with WebVTT subtitle support.
- **MediaSession** publishing correct playback state and transport controls (play / pause / rewind / fast-forward / seek) so the TV remote and system UI work.
- Continuous playback-position tracking drives every answer.
- Remote-first UI: one D-pad-reachable button, question "chips" selectable with the D-pad (no voice dependency), BACK to dismiss.
- Runs on the Android TV emulator `tv1080`; the same APK targets Fire OS (Fire TV runs Android).

## Spoiler safety — the core differentiator

Two independent layers:

1. **Layer-1 retrieval filter.** Every record (subtitles, events, clues, story states, frames, character facts) is timestamped, and every retrieval query is bounded by `maxTimestampMs = currentPosition`. Anything later simply does not exist in the context handed to the answerer.
2. **Layer-2 SpoilerGuard.** Before any text reaches the viewer, a validator checks it against future events by matching distinctive word-pairs; phrases already legitimately disclosed are exempt. A leak triggers a deterministic rewrite.

A **deterministic provider** produces the recap from the story index with no model at all — so the app works offline and the spoiler logic is regression-testable. An LLM provider (Anthropic / Amazon Bedrock) can be swapped in behind the same interface.

## Tech stack

| Layer | Tech |
|-------|------|
| TV app | Kotlin, Android, Media3 ExoPlayer, MediaSessionCompat, XML + ViewBinding |
| Video | HLS (ffmpeg-packaged), served by the backend; CloudFront-ready |
| Context | Pre-built JSON story index (scenes, events, clues, characters, objects, story states, frames) |
| Backend | TypeScript / Express, Zod validation, in-memory recap cache |
| AI | Provider abstraction: deterministic (default), Anthropic, Amazon Bedrock |
| Demo film | **Sintel** — Blender Foundation open movie, CC BY 3.0 |

## What is real vs placeholder (honest)

- **Real:** full spoiler-safe recap pipeline, retrieval engine, SpoilerGuard, clue listing, deterministic fallback, HLS delivery, 29 automated tests (all passing), story index built by actually watching Sintel frame-by-frame (238 frames, 10/10 timestamp accuracy spot-checks).
- **Real content:** Sintel (CC BY 3.0) with a hand-verified index of 14 scenes, 23 events, 7 clues. During development a **real Layer-1 leak was caught and fixed** — a scene summary and a clue were narrating the twist before its boundary.
- **Placeholder / not done on this machine:** the Android APK was written but compiled on a machine with the Android toolchain; demo captured on the **Android TV emulator**, not a physical Fire TV stick (same codebase, Fire OS compatible). No S3/CloudFront upload yet — video is served locally by the backend for the demo.

## Why it matters

The twist in Sintel — the final dragon is the baby dragon Scales she once loved — is exactly the kind of moment a naive "recap" would spoil. This product proves a TV assistant can be genuinely helpful *and* genuinely spoiler-safe, by treating time as a first-class constraint.
