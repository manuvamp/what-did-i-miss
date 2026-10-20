# Runbook

How to run everything and check it works. The README has the short version; this adds the verification checklist and troubleshooting. Last reviewed 2026-10-20.

## Status

| Piece | State |
|-------|-------|
| Backend (`backend/`) | Works. `npx vitest run`: 30 tests in 4 files pass. `tsc --noEmit` clean. |
| Android app (`app/`) | Compiles and runs on the Android TV emulator (API 33, x86) since 2026-10-14. |
| Physical Fire TV | **Not yet run on a Fire TV stick.** The same APK targets Fire OS; the steps in section 4 are untested on hardware. |
| Anthropic / Bedrock providers | Wired behind the provider interface, not run against live keys. |

## 1. Prerequisites

| Tool | Why |
|------|-----|
| Node.js 20+ | backend |
| JDK 17 | Gradle / Android build |
| Android SDK, platform 34, with `adb` and the emulator | build and run the app |
| An Android TV AVD named `tv1080` (the demo used API 33, x86) | the demo script boots this name |
| ffmpeg | prepare the HLS video and the frame images |

Copy `local.properties.template` to `local.properties` and set `sdk.dir` to your SDK. The file is gitignored.

## 2. Backend

```bash
cd backend
npm install
npx tsx src/server.ts            # PORT env var, default 3000
```

The demo uses port 3100 (`set PORT=3100` on Windows before starting). Check `http://localhost:3100/health`: it reports the active provider and content directory. The backend listens on all interfaces, so a Fire TV on the same network can reach it if the PC firewall allows the port (Windows, admin shell):

```
netsh advfirewall firewall add rule name="wdim-backend" dir=in action=allow protocol=TCP localport=3100
```

AI providers are optional. The default `deterministic` provider needs no keys.

```bash
# Anthropic
set AI_PROVIDER=anthropic && set ANTHROPIC_API_KEY=...        # optional: ANTHROPIC_MODEL

# Amazon Bedrock
set AI_PROVIDER=bedrock && set AWS_REGION=us-east-1           # optional: BEDROCK_MODEL_ID, plus AWS credentials
```

The backend reads environment variables only; it does not load `.env`. If a provider fails, the backend falls back to the deterministic one.

## 3. Video and frames

Neither the film nor the frame images are in the repo. Get Sintel from durian.blender.org (CC BY 3.0). The story index is timed to a copy that is 712.96 s long, 1920x818, with no audio; check with `ffprobe`. Then, from the repo root (full commands with explanations are in the README):

```bash
# 720p-wide Main-profile HLS (what the emulator plays)
mkdir -p dist/hls/sintel-720
ffmpeg -i sintel.mp4 -vf scale=1280:544 -c:v libx264 -profile:v main -pix_fmt yuv420p \
  -g 144 -keyint_min 144 -sc_threshold 0 -f hls -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename dist/hls/sintel-720/seg_%03d.ts dist/hls/sintel-720/index.m3u8

# Full-resolution copy
mkdir -p dist/hls/sintel
ffmpeg -i sintel.mp4 -c:v libx264 -pix_fmt yuv420p -f hls -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename dist/hls/sintel/seg_%03d.ts dist/hls/sintel/index.m3u8

# Story frames, one every 3 s
ffmpeg -i sintel.mp4 -vf "fps=1/3,scale=640:-1" -q:v 3 content/sintel/frames/seq_%04d.jpg
```

The backend serves `dist/hls/<name>/` at `/hls/<name>/` and frames at `/frames/sintel/<file>.jpg`.

## 4. Run on the emulator or a Fire TV

One command (boots the AVD, starts the backend on 3100, installs and launches the app):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_demo.ps1 [-Build]
```

`run_demo.ps1` expects `jdk17` and `android-sdk` inside `%USERPROFILE%\dev`; set `WDIM_DEV` to point elsewhere. `-Build` runs `gradlew.bat assembleDebug -PbackendUrl=http://10.0.2.2:3100 -PstreamPath=sintel-720`.

By hand:

```bat
gradlew.bat assembleDebug -PbackendUrl=http://10.0.2.2:3100 -PstreamPath=sintel-720
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.example.whatdidimiss/.MainActivity
```

Real Fire TV (untested on hardware):

1. Enable ADB debugging: Settings, My Fire TV, Developer Options.
2. `adb connect <fire-tv-ip>:5555`
3. Add the PC's LAN IP as a `<domain>` in `app/src/main/res/xml/network_security_config.xml`. The app only allows cleartext HTTP to `10.0.2.2` and `localhost`.
4. Build with `-PbackendUrl=http://<pc-lan-ip>:3100` (and `-PstreamPath=sintel` or `sintel-720`), then `adb install -r` the APK.

## 5. Verify on the device

Sintel timestamps are film time.

1. The film plays. MENU toggles the debug overlay (title, position, duration, scene).
2. Around 2:00, press FF several times to reach about 6:30, then press **M** (or INFO, or the on-screen button). The recap card says how much you missed and summarises the skipped range, not just the last 5 minutes. Repeated FF presses count as one skip.
3. The card shows the missed time, a summary and an IMPORTANT line, with the follow-up chips and Last 2 / 5 / 10 min buttons.
4. At about 6:30, **What clues do we know?** lists three clues (staff with a round engraved end, a wounded little dragon, a much larger dragon). It does not mention the tree on the disc (7:18), the enormous dragon in the cave (7:48) or anything later.
5. **Watch Missed Part** seeks to the start of the recapped range and plays.
6. **Continue Watching** resumes from the paused position.
7. Press **2**, **5** or **0**: a montage of up to three key moments plays with real frames. OK or right goes to the next one, BACK jumps to the text recap.
8. The D-pad moves focus between the recap buttons and chips; BACK dismisses the card.
9. Spoiler boundary: at about 10:15, in the cave just before the twist, a recap or answer never says the fallen dragon is Scales. At about 10:30 it may.

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| App shows "offline summary" | The backend is unreachable. Check the port, `BACKEND_URL` the APK was built with, the firewall rule, and that the emulator uses `10.0.2.2`. On a real device, check the cleartext domain list (section 4). Note the offline summary is not spoiler-checked (see README). |
| Emulator crashes or shows a black screen on play | The emulator's H.264 decoder cannot play the 1080p High-profile stream. Build with `-PstreamPath=sintel-720`. |
| Visual recap shows no pictures | The frame images are missing. Generate them (section 3). |
| Every recap request fails with 400 | The backend requires `currentPositionMs >= windowEndMs`. The app sends the larger of the two; if you call the API by hand, do the same. |
| Edits to the backend seem to have no effect | A stale `node` process is still listening on the port. Find it with `netstat -ano \| findstr :3100` and stop it. |
| UI crawls and screenshots lag behind the emulator | The host is short on RAM. Close other programs and restart the emulator. |
| `gradlew` fails with "SDK location not found" | Create `local.properties` with `sdk.dir` (section 1). |
