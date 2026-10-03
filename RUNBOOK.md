# Runbook — connecting everything

Everything is built. This is the ordered checklist to run the full system on a Fire TV device/simulator.

## 0. What is proven working right now

- Backend typechecks clean (`npx tsc --noEmit`)
- **23/23 backend tests pass** (`npx vitest run`): spoiler safety, retrieval, recap, questions, caching
- Live server smoke-tested: `/health`, `/api/content/:id`, `/api/recap`, `/api/question` all return correct, spoiler-safe responses
- Android project is fully written (player, MediaSession, recap overlay, question chips, offline fallback) but **was not compiled on this machine — no JDK/Android SDK is installed here**

## 1. Prereqs to install (one-time)

| Tool | Why |
|------|-----|
| Android Studio (Hedgehog+) | JDK 17 + Android SDK 34 + emulator images |
| `adb` | already installed (`platform-tools`) |
| ffmpeg | for packaging the real demo video |

## 2. Run the backend

```bash
cd backend
npm install        # done
npx tsx src/server.ts
```

Serves on `http://localhost:3000`. From a Fire TV emulator the app reaches it as `http://10.0.2.2:3000`; from a **physical Fire TV**, set `BACKEND_URL` in `app/build.gradle.kts` to the machine's LAN IP (e.g. `http://192.168.1.50:3000`) and run the backend on `0.0.0.0`.

To enable real AI recaps (optional — deterministic mode already works):

```bash
# Anthropic direct
set ANTHROPIC_API_KEY=... && set AI_PROVIDER=anthropic

# or Amazon Bedrock (hackathon AWS Builder mini-challenge)
set AI_PROVIDER=bedrock && set AWS_REGION=us-east-1
# credentials via AWS profile / env
```

## 3. Build & install the app

```bash
# from what-did-i-miss/ — requires Android Studio installed (provides SDK at %LOCALAPPDATA%\Android\Sdk)
echo sdk.dir=%LOCALAPPDATA%\Android\Sdk > local.properties
gradlew.bat assembleDebug
adb connect <FIRE_TV_IP>:5555        # physical device (enable ADB debugging on the TV)
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

On a physical Fire TV, update `BACKEND_URL`/`STREAM_URL` in `app/build.gradle.kts` first.

## 4. Point the player at "The Last Signal"

The app currently plays a public test HLS (bipbop) for plumbing verification. To use the real demo:

```bash
# package the produced video into HLS
scripts\package_video.sh movie.mp4 dist\hls last_signal

# upload to S3 + serve through CloudFront, then set STREAM_URL to:
# https://<distribution>.cloudfront.net/last-signal/last_signal_master.m3u8
```

The story index (`content/last-signal/*.json`) is already complete for this 9-minute, 10-scene film; keep the video edit aligned with the cue timestamps.

## 5. Verify on device (the "Definition of Done")

1. Video plays, subtitles sync (menu key toggles the debug overlay: title/position/duration/scene)
2. Skip forward >10s, then press **WHAT DID I MISS?** — the recap should prioritize the skipped range, not just "last 5 minutes"
3. Recap overlay shows missed time + summary + IMPORTANT clue, with follow-up chips
4. `What clues do we know?` at 5:30 lists 5 clues and never mentions the 7:00 reveal or the 8:00 signal
5. **Watch Missed Part** seeks exactly to `missedRange.startMs` and resumes
6. **Continue Watching** resumes from the exact paused position
7. D-pad moves focus between recap buttons and chips; BACK dismisses the overlay

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| App shows "offline summary" | Backend unreachable — check `BACKEND_URL`, LAN firewall, or emulator `10.0.2.2` |
| Black video but recap works | STREAM_URL invalid for the device — verify with `adb shell am start -a android.intent.action.VIEW -d <url>` in a browser-capable app, or check codec support |
| Recap empty for late timestamps | The bundled test stream is longer/shorter than the 9-minute story index — use the real packaged film |
