# Runbook — connecting everything

**Status tracker updated 2026-10-03.**

## 0. What's done (✅ vs ⬜)

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Housekeeping | ✅ | git init'd, `.gitignore` written, 3 commits, backend re-verified |
| 0.3 Backend re-verify | ✅ | `tsc --noEmit` clean, **23/23 vitest**, live `/api/recap` smoke test OK |
| 0.4 Spoiler spot-check @60s/330s/480s | ✅ | no leaks; boundary exact at 481s vs 483s |
| 1 Toolchain (Android Studio) | ⬜ [HUMAN] | nothing installable from CLI here |
| 2 Compile app | ⬜ [HUMAN unblock] | **pre-build blockers FIXED statically** (icon, wrapper jar, proguard, defaultConfig merge, networkSecurityConfig). Ready for first `gradlew assembleDebug`. |
| 3 Device (Fire TV / emulator) | ⬜ [HUMAN] | `adb devices` empty; enable Developer Options on TV or create AVD |
| 4 Demo content | ⬜ [HUMAN 4A / partial 4B] | no ffmpeg here; bipbop placeholder works for plumbing |
| 5 On-device verification | ⬜ blocked on 3 | 7-point checklist below |
| 6 AI upgrade | ⬜ optional | `AI_PROVIDER=anthropic|bedrock` after deterministic works on device |
| 7 Deliverables | ⬜ [HUMAN] | record on device, push to GitHub, write submission |

## 1. Prereqs to install (one-time) [HUMAN]

| Tool | Why |
|------|-----|
| Android Studio (Hedgehog+) | JDK 17 + Android SDK 34 + emulator images |
| `adb` | already installed (`platform-tools`) |
| ffmpeg | for packaging the real demo video (Phase 4A) |

`local.properties` is **pre-created** with `sdk.dir=C:\\Users\\cocat\\AppData\\Local\\Android\\Sdk`. If your SDK is elsewhere, edit it.

## 2. Run the backend

```bash
cd backend
npm install        # done
npx tsx src/server.ts
```

Serves on `http://localhost:3000`. From a Fire TV emulator the app reaches it as `http://10.0.2.2:3000`; from a **physical Fire TV**, set `BACKEND_URL` in `app/build.gradle.kts` to the machine's LAN IP (e.g. `http://192.168.1.50:3000`) and run the backend on `0.0.0.0`. Open the firewall once (admin shell):

```
netsh advfirewall firewall add rule name="recap3000" dir=in action=allow protocol=TCP localport=3000
```

To enable real AI recaps (optional — deterministic mode already works):

```bash
# Anthropic direct
set ANTHROPIC_API_KEY=... && set AI_PROVIDER=anthropic

# or Amazon Bedrock (hackathon AWS Builder mini-challenge)
set AI_PROVIDER=bedrock && set AWS_REGION=us-east-1
```

## 3. Build & install the app

```bash
# from what-did-i-miss/ — local.properties already set
gradlew.bat assembleDebug
adb connect <FIRE_TV_IP>:5555        # physical device (after enabling ADB debugging on the TV)
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

On a physical Fire TV, update `BACKEND_URL`/`STREAM_URL` in `app/build.gradle.kts` first.

## 4. Point the player at "The Last Signal"

The app currently plays the public bipbop HLS (works, has WebVTT subtitles, ~10min) for plumbing verification. To use the real demo:

```bash
# package the produced video into HLS (needs ffmpeg)
scripts\package_video.sh movie.mp4 dist\hls last_signal

# serve locally for a demo (simplest): 
npx http-server dist/hls -p 8080 --cors
# then set STREAM_URL to http://10.0.2.2:8080/last_signal_master.m3u8

# OR upload to S3 + CloudFront and use https://<distribution>.cloudfront.net/last-signal/last_signal_master.m3u8
```

The story index (`content/last-signal/*.json`) is complete for the 9-minute, 10-scene film; keep the video edit aligned with the cue timestamps. **Phase 4B alternative:** keep bipbop, retime `scenes.json`/`events.json`/`clues.json` to bipbop's actual beats (it has no mystery plot, so this only proves plumbing, not product value — prefer 4A).

## 5. Verify on device (the "Definition of Done")

1. Video plays, subtitles sync (MENU key toggles debug overlay: title/position/duration/scene)
2. Skip forward >10s, then press **WHAT DID I MISS?** — recap prioritizes the skipped range
3. Recap overlay shows missed time + summary + IMPORTANT clue, with follow-up chips
4. `What clues do we know?` at 5:30 lists 5 clues and never mentions the 7:00 reveal or 8:00 signal
5. **Watch Missed Part** seeks exactly to `missedRange.startMs` and resumes
6. **Continue Watching** resumes from the exact paused position
7. D-pad moves focus between recap buttons and chips; BACK dismisses the overlay

**Server-side spoiler verification (already done via curl):** see §0 — 60s/330s/480s all clean, boundary exact.

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| App shows "offline summary" | Backend unreachable — check `BACKEND_URL`, firewall rule, or emulator `10.0.2.2` |
| Black video but recap works | STREAM_URL invalid — bipbop is known-good; check codec support or CloudFront CORS |
| Recap empty for late timestamps | bipbop length ≠ 9-min story index — that's expected until Phase 4A |
| `gradlew` fails immediately | `gradle-wrapper.jar` missing — it's committed, run `git status` to confirm |
| AAPT "resource not found ic_launcher" | stale build — `gradlew clean` then rebuild (icon is committed) |

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
