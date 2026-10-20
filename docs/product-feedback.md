# Product Feedback

Notes on every tool touched during this build, from what actually happened. Sources: the friction log, the test output and the runs on the emulator. Last updated 2026-10-20.

## ffmpeg / HLS packaging

- **Worked:** frame extraction (`fps=1/3`), scene-change detection (`select='gt(scene,0.3)'`) and HLS packaging all ran clean. The 183 MB (175 MiB) 1920x818 Sintel source became a 116-segment `index.m3u8` at full resolution, plus a second copy re-encoded to H.264 Main at 1280x544 (about 119 six-second segments) for the emulator.
- **Hurt:** `drawtext` on the gyan.dev WinGet build is effectively broken: it segfaults without a system fontconfig, and `FONTCONFIG_FILE` didn't help. Only an explicit `fontfile=...` worked. Filter args also split on `:`, so timestamps need `00\:03`-style escaping, which the docs don't make obvious.
- **Also:** `fps=1/3` names frames by number, but the image for `seq_NNNN` shows film time `(NNNN-1)*3 + 1.5` s. That offset is easy to miss and cost us a wrong index (see friction log, 2026-10-14).
- **Suggestion:** ship a fontconfig fallback on Windows; warn about `:` in `text=` values.

## Media3 / ExoPlayer & HLS

- **Worked:** Media3 1.2.1's HLS support and `currentPosition` give the precise, seek-aware position the spoiler model needs. The `onPositionDiscontinuity` callback with `DISCONTINUITY_REASON_SEEK` is what detects a forward skip and turns it into a "missed range". This now runs on the emulator.
- **Fixed after the first runs:** each FF press used to start a new missed range, so a recap covered only the last 15-second jump. Consecutive skips (the next one starting within 5 s of the previous end) now extend one range. A skip stays "the missed part" until the viewer has watched a minute past it; after that, the recap falls back to the last 5 minutes.
- **Hurt:** `currentPosition` as read from our 500 ms snapshot lags the real position, and the snapshot stops updating while paused. Using it as the "now" of a request produced the 400 errors described in the friction log (fixed: the request uses the larger of snapshot position and window end).
- **Not covered:** the app uses Media3's HLS and rendering, but there are no subtitles in the demo (the film has no dialogue), so WebVTT handling is untested in this repo.

## MediaSession

- Chose **legacy `MediaSessionCompat`** (androidx.media) bridged to ExoPlayer rather than Media3 `MediaSession`, to keep a single-activity v1 simple and still publish play/pause/rew/ff/seek and position for the TV remote and system UI. This is a deliberate trade, documented in code. If advanced session features (custom commands, multi-session) are needed, migrate to `Media3SessionService`.

## Fire TV / Android TV emulator

- **Run so far:** an Android TV AVD, `tv1080` (API 33, x86). The APK compiled and ran there from 2026-10-14. The backend is reached at `10.0.2.2` (the demo uses port 3100). This is Android TV, not Fire OS; **nothing has been run on a physical Fire TV stick.**
- **Hurt:** the emulator's software H.264 decoder (goldfish) crashes on the 1080p High-profile stream; the demo plays a Main-profile 1280x544 copy instead. When the host was short on RAM the emulator UI dropped to about 1 frame per second and screencaps went stale. The emulator keyboard has no media fast-forward key (we used `adb shell input keyevent 90`), and a `monkey` launch sometimes left the TV launcher in front (`am start -n` was reliable). Details in the friction log.
- **Hurt (real devices):** the app's network security config only allows cleartext HTTP to `10.0.2.2` and `localhost`, so a Fire TV on the LAN needs the PC's IP added before it can reach the backend.

## Express / TypeScript backend

- **Worked:** Zod request validation, an in-memory recap cache keyed by `contentId:start:end`, and an `express.static` route to serve HLS with correct MIME types (`application/vnd.apple.mpegurl`, `video/mp2t`). `npx tsx` gives a fast dev loop. The backend also serves the story frames for the visual recap.
- **Hurt:** a **stale `node` listener on :3000** shadowed fresh code during debugging and masked a real spoiler-leak fix until the old PIDs were killed.
- **Suggestion:** add a `/__version` start-timestamp and a dev pre-flight that refuses a second listener.

## The spoiler-safety model itself

- Building the story index **by watching the film** is what makes the spoiler boundary trustworthy: you can't gate a twist you haven't localized. 238 extracted frames and 15 contact sheets were the working material.
- The first index was **not** trustworthy. It was partly invented (a forge, sword and map that are not in the video) and its "10/10 spot checks" claim was contradicted by the images on disk. It was rebuilt from the frames on 2026-10-14 (16 scenes, 28 events, 7 clues) and every event was then checked against an independent ffmpeg frame. The lesson: a spoiler gate is only as good as the index behind it, and "verified" needs evidence on disk.
- Found and fixed a genuine Layer-1 leak (scene prose and one clue narrating the twist before its boundary). This validated the two-layer design: retrieval filtering alone was not enough because coarse scene summaries bypassed per-event gates.
- **Fixed 2026-10-20:** the app's offline fallback (backend unreachable) used to show the current scene's whole summary, which could state the twist between 10:05 and 10:22. It now shows only scenes that finished inside the window plus the current scene's title. The LLM prompt got the same change.

## LLM providers (Anthropic / Bedrock)

- The deterministic provider is the default and the test baseline. It needs no credentials and makes the spoiler logic fully regression-testable (30 tests in 4 files, all passing).
- The Anthropic and Bedrock providers sit behind the same interface and were wired but **not exercised against live API keys**. If a provider throws, or its text trips SpoilerGuard, the backend falls back to deterministic output.
