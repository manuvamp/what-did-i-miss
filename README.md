# What Did I Miss?

An Android TV / Fire TV app that answers one question while you watch: *what did I just miss?* Press one button on the remote and you get a short recap of the part you skipped or looked away from, with real frames from the film, and follow-up answers ("Why is that important?", "What clues do we know?"). It never tells you anything that happens after the point you have reached, and it only retells the story up to your exact playback position. The demo film is Sintel.

Demo video: https://youtu.be/l0I2koamVWE

**Status:** built and run on the Android TV emulator (API 33, x86). It has not been run on a physical Fire TV stick yet. The app is a standard Android TV app (Kotlin, Media3) and the steps to sideload it onto a real Fire TV are below, but those steps are untested on hardware.

## Features

- **Recap of the part you missed.** If you skipped ahead and the skip ended less than a minute ago, the recap covers the skipped range. Otherwise it covers the last 5 minutes.
- **Visual recap.** A short montage of up to three key moments from the last 2, 5 or 10 minutes: a real film frame for each moment, with a one-line story caption.
- **Follow-up questions** on the recap card: *Why is that important?*, *What clues do we know?*, *Who is involved?*, *What happened earlier?* Each answer is limited to what has happened by your current position.
- **Watch Missed Part** jumps back to the start of the range that was recapped. **Continue Watching** resumes where you were.
- **Skip detection.** FF and REW on the remote jump 15 seconds. Repeated presses merge into one skip, so one recap covers the whole jump.
- **Works without an API key.** The default recap engine is deterministic (it writes the recap from the story index). Anthropic and Amazon Bedrock providers can be switched on behind the same interface.
- **Offline fallback.** If the backend is unreachable the app shows a basic summary built from the scene index bundled in the APK. See "Known limitations".

## How it works

```
Fire TV / Android TV app (Kotlin, Media3 ExoPlayer)
   plays HLS, tracks position every 500 ms, detects skips
              |  POST /api/recap, /api/question  (position + window)
              v
Backend (TypeScript, Express)
   StoryEngine  -> timestamp-bounded retrieval from the story index
   AI provider  -> deterministic (default) | Anthropic | Bedrock
   SpoilerGuard -> checks the generated text, rewrites if it leaks
              |
              v
Story index (content/sintel/*.json): scenes, events, clues, characters,
objects, story states, frames
```

Spoiler safety has two layers:

1. **Timestamp-bounded retrieval.** Every query carries `maxTimestampMs` (the current position). Events, clues, character facts, story states and frames after that point are never loaded into the context, so the answer engine cannot see them. Events also carry a `spoilerBoundaryMs`, the time at which they are safe to mention, which is how the twist is held back until after it has played.
2. **SpoilerGuard.** Before a recap or answer is returned, `backend/src/validation/SpoilerGuard.ts` compares the text against every event that happens later. It builds word pairs from each future event's description and flags the text if a pair appears close together in it (pairs already known from clues the viewer has seen are exempt). On a hit, the backend discards the text and writes a deterministic recap from the allowed events instead. If an AI provider throws, the backend falls back to the deterministic provider.

The story index was built by watching the film frame by frame, not by running a model over it; see `content/sintel/ANALYSIS_NOTES.md`.

## Remote controls

| Key | Action |
|-----|--------|
| FF / REW | Jump 15 seconds. Consecutive presses merge into one skip |
| **M** or **INFO** | "What did I miss?" (recap of the skipped range, or the last 5 minutes) |
| **2** / **5** / **0** | Visual recap of the last 2 / 5 / 10 minutes |
| OK or right (during the montage) | Next moment |
| BACK (during the montage) | Skip to the text recap |
| BACK (on the recap card) | Dismiss and keep watching |
| MENU | Toggle the debug overlay (title, position, duration, scene) |

The recap card has **Continue Watching**, **Watch Missed Part**, **Last 2 / 5 / 10 min** and the four follow-up chips. The **M**, **INFO** and number keys are shortcuts for development and demos; on a Fire TV remote use the on-screen buttons.

## Quick start

Prerequisites: Node.js 20+, JDK 17, the Android SDK (platform 34) with `adb`, and either an Android TV emulator (AVD) or a Fire TV device. `ffmpeg` is needed to prepare the demo video and frames.

### 1. Backend

```bash
cd backend
npm install
npx tsx src/server.ts          # listens on PORT (default 3000)
```

The one-command demo below uses port 3100. `GET /health` reports the provider and content directory.

Optional AI providers (the default, `AI_PROVIDER=deterministic`, needs nothing):

| Provider | Environment |
|----------|-------------|
| Anthropic | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` |
| Amazon Bedrock | `AI_PROVIDER=bedrock`, `AWS_REGION`, optional `BEDROCK_MODEL_ID`, AWS credentials from the usual environment or profile |

The backend reads real environment variables only; it does not load `.env` files. These providers have not been run against live keys in this repo, so treat them as wired but unverified.

### 2. Demo video (not in the repo)

The film and the HLS segments are not committed (`dist/` and `*.mp4` are gitignored; see "Content credits" for the licence of the film). Get Sintel from [durian.blender.org](https://durian.blender.org). The story index is timed to one specific copy: **712.96 s (11:53), 1920x818, no audio track**. Check yours with `ffprobe`; if the length differs, timestamps will not line up.

Put the file at `sintel.mp4` (any path works), then from the repo root:

```bash
# 720p-wide Main-profile HLS: this is what the emulator plays (see the note below)
mkdir -p dist/hls/sintel-720
ffmpeg -i sintel.mp4 -vf scale=1280:544 \
  -c:v libx264 -profile:v main -pix_fmt yuv420p -g 144 -keyint_min 144 -sc_threshold 0 \
  -f hls -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename dist/hls/sintel-720/seg_%03d.ts \
  dist/hls/sintel-720/index.m3u8

# Full-resolution copy; the backend serves it at /hls/sintel/index.m3u8
mkdir -p dist/hls/sintel
ffmpeg -i sintel.mp4 -c:v libx264 -pix_fmt yuv420p -f hls -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename dist/hls/sintel/seg_%03d.ts \
  dist/hls/sintel/index.m3u8

# Story frames (already committed in content/sintel/frames; only needed for a new film)
# ffmpeg -i sintel.mp4 -vf "fps=1/3,scale=640:-1" -q:v 3 content/sintel/frames/seq_%04d.jpg
```

Why two streams: the emulator's software H.264 decoder (goldfish) crashes on the 1080p High-profile stream, so the demo uses a Main-profile copy scaled to 1280 px wide (the film is 2.35:1, so that is 1280x544). The keyframe flags in the 720p command give even 6-second segments (144 frames at 24 fps); without them the segment lengths follow the source's scene cuts. The backend serves anything under `dist/hls/` at `/hls/<name>/`.

`scripts/package_video.sh` is an older multi-bitrate packager. It writes `<name>_master.m3u8`, not the `index.m3u8` the app expects, so use the commands above for the demo. The frame images are named `seq_NNNN.jpg` and the story index refers to them by that name. 

### 3. Run the demo on the emulator

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_demo.ps1 [-Build]
```

The script starts the backend on port 3100, boots an Android TV AVD named `tv1080`, installs the debug APK and launches it. `-Build` rebuilds the APK with `-PbackendUrl=http://10.0.2.2:3100 -PstreamPath=sintel-720` (`10.0.2.2` is how the emulator reaches the host).

Before the first run:

- Create an Android TV (1080p) AVD called `tv1080` in Android Studio's Device Manager. The demo was recorded on API 33, x86.
- Copy `local.properties.template` to `local.properties` and set `sdk.dir`.
- `run_demo.ps1` expects `jdk17` and `android-sdk` inside `%USERPROFILE%\dev`; set `WDIM_DEV` to use another folder, or start the pieces by hand: run the backend as in step 1 with `PORT=3100`, then
  ```bat
  gradlew.bat assembleDebug -PbackendUrl=http://10.0.2.2:3100 -PstreamPath=sintel-720
  adb install -r app\build\outputs\apk\debug\app-debug.apk
  adb shell am start -n com.example.whatdidimiss/.MainActivity
  ```
  (The repo only ships the Windows wrapper, `gradlew.bat`. On macOS or Linux, use a local Gradle install or generate a wrapper.)

### 4. A real Fire TV (not yet tested on hardware)

1. On the stick: Settings, My Fire TV, Developer Options, turn on ADB debugging.
2. `adb connect <fire-tv-ip>:5555`
3. The app only allows cleartext HTTP to `10.0.2.2` and `localhost`. Add your PC's LAN IP as another `<domain>` line in `app/src/main/res/xml/network_security_config.xml`.
4. Allow the backend port through the PC firewall, then build with the PC's LAN IP: `gradlew.bat assembleDebug -PbackendUrl=http://<pc-lan-ip>:3100 -PstreamPath=sintel`, and `adb install -r app\build\outputs\apk\debug\app-debug.apk`. (`-PstreamPath=sintel-720` is the safer choice if the full-resolution stream stutters; neither has been tried on a stick.)

The same APK is meant for Fire OS, which is Android-based, but nothing in this repo proves that yet.

## Tests

```bash
cd backend
npm install
npx vitest run        # 30 tests in 4 files (spoiler, retrieval, API, Sintel spoiler boundary)
npx tsc --noEmit      # type check
npm run validate:content -- ../content/sintel    # story-index consistency check
```

The test files live in `tests/` and run through `backend/vitest.config.ts`. Everything runs against the deterministic provider, so no keys or network are needed. Seven tests (`tests/spoiler/sintel-spoiler.test.ts`) check the real Sintel index, including the twist boundary at 622 s. The other 23 run against `content/last-signal/`, a small fictional index kept as a test fixture (see Known limitations). The tests check the backend only; the Android app has no automated tests, and the app and the emulator run were checked by hand.

## Demo content

Sintel's story index (`content/sintel/`): 16 scenes, 28 events, 7 clues, 6 characters, 7 objects, 12 story states and 238 frames (one every 3 seconds). The film has no dialogue and the copy used has no audio, so there are no subtitles; every caption describes only what is on screen.

The twist is that the dragon Sintel kills in the cave is Scales, the little dragon from the rooftops, grown up. It plays at about 10:06. Recaps will not say so before 10:22 (622 s): the events and clue that state it unlock then, and before that the text says "the little dragon" and "the enormous dragon".

## Known limitations

- **The offline fallback is simpler.** If the backend cannot be reached, the app shows the summaries of scenes that finished inside the missed window plus the current scene's title (never the summary of the scene still playing, which can run ahead of the playhead). It does not go through SpoilerGuard.
- Run on an emulator only. No physical Fire TV testing, no Fire OS testing.
- The Anthropic and Bedrock providers have not been exercised against live keys.
- The index is for one film and one copy of it. Adding another title means building a new story index by hand (see `docs/content-pipeline.md`).
- `content/last-signal/` is an older fictional index ("The Last Signal", a fictional film) kept because most backend tests use it as a fixture. It is not part of the demo.
- Frame images are named for a time that is 1.5 s off from what they show (`seq_NNNN.jpg` shows film time `(NNNN-1)*3 + 1.5` s). The index compensates for this; the notes are in `content/sintel/ANALYSIS_NOTES.md`.

## Docs

- `docs/architecture.md`, `docs/ai.md`, `docs/player.md`: design
- `docs/content-pipeline.md`: how a story index is made
- `docs/testing.md`: test plan and manual checks
- `docs/friction-log.md`, `docs/product-feedback.md`: real problems and notes on the tools used
- `docs/demo-script.md`, `docs/submission.md`: the 90-second demo and the submission write-up
- `RUNBOOK.md`: step-by-step build and device checks

## Content credits

Demo film: **Sintel** (c) Blender Foundation | durian.blender.org, licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The 238 frame images in `content/sintel/frames/` are stills from it, under the same licence. This project is not endorsed by or affiliated with Blender. The story index (scenes, events, clues, captions) was written by the project team from the film.

## License

Code: MIT, see `LICENSE`. Sintel and frames taken from it: CC BY 3.0 (above).
