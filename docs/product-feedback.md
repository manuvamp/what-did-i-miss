# Product Feedback

Real notes on every tool touched during this build. Sources: git log, this session's friction-log, and the test/QA output. Nothing invented.

## ffmpeg / HLS packaging

- **Worked:** scene extraction (`fps=1/3`), scene-change detection (`select='gt(scene,0.3)'`), and HLS packaging (`-c:v libx264 -hls_time 6 -hls_playlist_type vod`) all ran clean. 117 segments + a valid `index.m3u8` from the 175 MB Sintel source.
- **Hurt:** `drawtext` on the gyan.dev WinGet build is effectively broken — it segfaults without a system fontconfig, and `FONTCONFIG_FILE` didn't help. Only an explicit `fontfile=...` worked. Also, filter args split on `:` so timestamps need `00\:03`-style escaping, which is not obvious from the docs.
- **Suggestion:** ship a fontconfig fallback on Windows; warn about `:` in `text=` values.

## Media3 / ExoPlayer & HLS

- **Worked:** Media3 1.2.1's HLS + WebVTT support and `currentPosition` polling are exactly what the spoiler-safety model needs — precise, seek-aware, and the listener API exposes position discontinuities (which power the "forward skip = missed range" detection).
- **Not yet exercised on hardware:** the Kotlin app is written against Media3 but compiled only after the Android toolchain is installed (see RUNBOOK). Emulator run is Prompt-3/Prompt-5 scope.

## MediaSession

- Chose **legacy `MediaSessionCompat`** (androidx.media) bridged to ExoPlayer rather than Media3 `MediaSession`, to keep a single-activity v1 simple and still publish play/pause/rew/ff/seek + position for the TV remote/system UI. This is a deliberate trade, documented in code. If advanced session features (custom commands, multi-session) are needed, migrate to `Media3SessionService`.

## Fire TV / Android TV emulator

- Not yet run (toolchain not installed on this machine). Planned: `tv1080` Android TV AVD, backend reachable at `10.0.2.2:3000`. Emulator is Android TV, not Fire OS — called out plainly in the submission.

## Express / TypeScript backend

- **Worked:** Zod request validation, an in-memory recap cache keyed by `contentId:start:end`, and an `express.static` route to serve HLS with correct MIME types (`application/vnd.apple.mpegurl`, `video/mp2t`). `npx tsx` gives a fast dev loop.
- **Hurt:** a **stale `node` listener on :3000** shadowed fresh code during debugging and masked a real spoiler-leak fix until the old PIDs were killed.
- **Suggestion:** add a `/__version` start-timestamp and a dev pre-flight that refuses a second listener.

## The spoiler-safety model itself

- Building the story index **by watching the film** (238 extracted frames, 15 contact sheets, 10/10 timestamp spot-checks) was what made the spoiler boundary trustworthy — you can't gate a twist you haven't localized. Found and fixed a genuine Layer-1 leak (scene prose + one clue narrating the twist pre-boundary). This validated the two-layer design: retrieval filtering alone was not enough because coarse scene summaries bypassed per-event gates.

## LLM providers (Anthropic / Bedrock)

- Deterministic provider is the default and the test baseline — it needs no credentials and makes spoiler logic fully regression-testable (29/29). The Anthropic/Bedrock providers sit behind the same interface and were wired but not exercised against live API keys in this pass.
