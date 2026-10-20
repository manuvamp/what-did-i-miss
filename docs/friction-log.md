# Friction Log

This document records real problems encountered during development, with actual details.

---

## 2026-10-03 — Pre-build static audit (Claude Code session)

**Task:** Run first `gradlew assembleDebug` on a machine with no Android tooling
**Expected:** Project written per spec should compile on first human build
**Actual:** Five first-build blockers found in static audit *before* any compile:
1. `mipmap/ic_launcher` referenced in manifest but no icon resource existed → AAPT resource-link failure
2. `gradle-wrapper.jar` absent → `gradlew.bat` fails instantly ("Could not find or load main class org.gradle.wrapper.GradleWrapperMain")
3. `proguard-rules.pro` referenced in `buildTypes.release` but missing
4. Duplicate `defaultConfig {}` blocks in `app/build.gradle.kts` (second re-opened the first; would silently override on some AGP versions)
5. Broad `android:usesCleartextTraffic="true"` flagged by lint as a security risk for a media app
**Severity:** Blocker (1, 2), High (3, 4), Medium (5)
**Workaround:** Created adaptive-icon XML (`mipmap-anydpi-v26/ic_launcher.xml` + vector foreground, no PNG needed); downloaded `gradle-wrapper.jar` v8.5.0 from the Gradle GitHub distribution; created proguard stub; merged defaultConfig blocks; replaced broad cleartext with `res/xml/network_security_config.xml` scoped to `10.0.2.2`/`localhost` only.
**Suggested improvement:** Any generated Android scaffold should include icon, wrapper jar, and proguard stub by default — these are the top-3 "why won't my fresh project build" causes.

**Task:** Verify spoiler-safety end-to-end at the to-do's named timestamps (60s / 330s / 480s)
**Expected:** spec-compliant boundary
**Actual:** PASS at all three; boundary precision confirmed around clue_06 (482s): absent at 481s, present at 483s.
**Severity:** — (no friction, verification result)

**Task:** Connect a Fire TV via `adb` for on-device verification
**Expected:** `adb devices` lists a device
**Actual:** `List of devices attached` empty; daemon started at `tcp:5037` but nothing paired
**Severity:** Blocker for on-device phases
**Workaround:** [HUMAN] — enable Developer Options (Settings → My Fire TV → About → tap Build ×7), enable ADB Debugging, `adb connect <tv-ip>:5555`

## 2026-10-04 — Sintel content pipeline + SpoilerGuard tuning (Claude Code session)

**Task:** Build contact-sheet montages with `ffmpeg drawtext` timestamp overlays on Windows
**Expected:** `drawtext=text='00:03'` inside a `filter_complex_script` renders the burned-in label
**Actual:** THREE separate tooling failures, each with a distinct root cause:
1. FFmpeg filter args split on `:` even inside `text='...'` — the `mm:ss` colon must be backslash-escaped (`00\:03`), else "No option name near '00:x=...'".
2. The gyan.dev WinGet FFmpeg build **segfaults in `drawtext`** because it can't find a fontconfig config (`Fontconfig error: Cannot load default config file`). Supplying `FONTCONFIG_FILE` did not fix it; only switching to an explicit `fontfile='C:/Windows/Fonts/arial.ttf'` bypassed the fontconfig DB and worked.
3. `vstack` failed with "Padded dimensions cannot be smaller than input dimensions" because the 640px-wide source frames scale to 374px (818px source aspect), so my hardcoded `pad=1280` target was smaller than the real 1496px row. Fixed by forcing every cell to an exact `320x140` box (`scale=...:force_original_aspect_ratio=decrease,pad=320:140:...`).
**Severity:** Medium (blocking tooling, but diagnosable)
**Workaround:** Explicit `fontfile` + fixed-dimension cells + `filter_complex_script` files (avoids all shell-quoting issues).
**Suggested improvement:** A "contact sheet with timestamps" is a common need; a single ffmpeg incantation that worked cross-platform without fontconfig would save real time. Document the `:`-escaping for `drawtext` prominently.

**Task:** Verify Sintel recap is spoiler-safe at the reveal boundary
**Expected:** At 11:20 (680s), just before the 11:30 reveal boundary, the recap must NOT narrate the twist
**Actual:** **REAL Layer-1 leak found and fixed.** Two independent causes:
1. `DeterministicProvider.buildSummary` dumped `currentScene.summary` verbatim, and scene_13's prose (633–690s) narrated the recognition twist — bypassing the per-event `spoilerBoundaryMs` gate. Fixed by building the recap only from time-gated events, never the raw scene prose.
2. `clue_07` ("The Dragon Recognizes Sintel") had `discoveredAtMs: 624s`, so it passed the clue filter at 680s even though it IS the twist. Fixed by gating its discovery to the actual reveal boundary (690s).
A MASKING BUG made this hard to see during dev: a **stale backend process** (two node.exe listeners on :3000) kept serving the OLD code after edits, so fixes appeared not to work until both PIDs were force-killed.
**Severity:** Blocker (if shipped, the recap spoils the film's central twist)
**Workaround:** Gate scene prose + clue discovery to spoiler boundaries; kill stale node listeners before re-testing.
**Suggested improvement:** A `GET /__version` health field reporting the server start-timestamp would make stale-process bugs obvious. Consider a `lsof`-style pre-flight in the dev script that refuses to start a second listener on :3000.

**Task:** Surface the early→late "Scales bond" link in prior-context at the fight
**Expected:** When asking at the dragon fight, the recap connects back to Sintel bonding with baby Scales
**Actual:** Initially the top prior-context was only recent high-importance events (sword, map) — the semantically-critical Scales bond was buried because "Scales" ≠ "Adult Dragon" as strings and recency dominated ranking.
**Severity:** Medium (product-quality, not a crash)
**Workaround:** Expanded `retrievePriorContext` to add characters via the static `relationships` graph (Scales and Adult Dragon both relate to Sintel), and reweighted character-overlap (0.45) above recency (0.05). The link now surfaces without leaking (relationships are static metadata).
**Suggested improvement:** When a twist links two entities that are "the same character at different times", a single canonical `entityId` spanning both names would be cleaner than string-matching.

> **Note added 2026-10-20: the numbers in the 2026-10-04 entries above were superseded.** (The 2026-10-03 spoiler spot checks at 60 / 330 / 480 s were run on the fictional "The Last Signal" index, which predates Sintel.) They describe the first Sintel index, which was partly invented and rebuilt on 2026-10-14 (see that entry). The rebuilt index has 16 scenes, 28 events and 7 clues; the twist plays at about 10:06 and the reveal events unlock at 10:22 (622 s), not 11:30 / 690 s. The sword, map and forge scenes mentioned above do not exist in the film. The demo backend now uses port 3100 (3000 is the default). The entries are kept as written because the process problems they describe (drawtext, stale listener, scene prose bypassing the event gate) were real.

---

## 2026-10-14 — First compile, first emulator run, index rebuilt

**Task:** First `gradlew.bat assembleDebug` and first run of the app on the `tv1080` Android TV emulator (API 33, x86)
**Expected:** The app builds and the film plays
**Actual:** The APK built and installed. Playback then crashed in the emulator's decoder (next item).
**Severity:** — (milestone: first time the app ran anywhere)

**Task:** Play the 1080p Sintel HLS stream on the emulator
**Expected:** Video plays, as it does in a browser
**Actual:** The emulator's software H.264 decoder (goldfish) crashed on the stream. The source is 1920x818 H.264 High profile.
**Severity:** Blocker for the emulator demo (a physical device would use its hardware decoder; not tested)
**Workaround:** A second HLS copy re-encoded as Main profile at 1280x544 (`dist/hls/sintel-720`). The app picks it with `-PstreamPath=sintel-720`; `scripts/run_demo.ps1` passes that flag.
**Suggested improvement:** The emulator should refuse unsupported profiles with a clear message instead of crashing. A docs note about which H.264 profiles the TV system images decode would have saved the detour.

**Task:** Press "What did I miss?" on the emulator
**Expected:** A recap card
**Actual:** Every recap request came back 400. The backend requires `currentPositionMs >= windowEndMs`, but the app sent the playback snapshot's position, which is refreshed on a 500 ms timer (and not at all while paused) and so lagged the end of the window.
**Severity:** Blocker (the headline feature never worked on the first run)
**Workaround:** `RecapController` now sends `max(snapshot position, window end)`; the end of the window is "now" by definition.
**Suggested improvement:** Read the player's position at the moment of the request, not from a cached snapshot. The 400 body names the violated rule, which is what made this quick to find.

**Task:** Check the Sintel story index against the film
**Expected:** The index written on 2026-10-04 matched the video, as its notes claimed (10/10 spot checks)
**Actual:** It was partly hallucinated. It described a forge, a sword and a map that are not in this video, and put other events on the wrong shots (at 345 s the film shows a desert dissolve and a bamboo forest). The saved check images contradicted the "10/10" claim.
**Severity:** Blocker (every recap would have described scenes that do not exist)
**Workaround:** Rebuilt every scene, event, clue, character fact, object and story state from the extracted frames, describing only what is visible: 16 scenes, 28 events, 7 clues, 6 characters, 7 objects, 12 story states. Each event now has a narrative `story` line (shown to the viewer) next to a visual `description`. All 28 events were then checked against ffmpeg frames; side-by-side images are in `content/sintel/accuracy/` (local, not committed). Details in `content/sintel/ANALYSIS_NOTES.md`.
**Suggested improvement:** Do not accept a "verified" claim without the evidence on disk. A validation script that compares the index against an independent frame grab would catch this class of error.

**Task:** Place events on frames using `frames.json`
**Expected:** `seq_NNNN.jpg` shows film time `(NNNN-1)*3` s, as `frames.json` records
**Actual:** The images show `(NNNN-1)*3 + 1.5` s (found by PSNR against ffmpeg frames for six frames, peak at +1.5 s each time). The contact-sheet labels had the same offset, which caused part of the misplacement above.
**Severity:** Medium
**Workaround:** `frames.json` was left as is. Each event's `timestampMs` is set so the frame nearest to `timestampMs + 1.5 s` is the shot its caption describes, and the backend aims 1.5 s after an event when it picks the frame to show.
**Suggested improvement:** Record the real time of each frame when extracting it, instead of deriving it from the file number.

---

## 2026-10-20 — Recording the demo on the emulator

**Task:** Record the demo on the emulator while the host was busy
**Expected:** A smooth screen capture
**Actual:** With little free RAM on the host, the emulator UI ran at about 1 frame per second and `adb` screencaps came back stale, so a capture could show a screen from several seconds earlier.
**Severity:** Medium (wasted takes)
**Workaround:** Close other programs before recording and check that a screencap matches the current screen before trusting it.
**Suggested improvement:** Document a minimum host RAM for the Android TV emulator plus a screen recorder.

**Task:** Send the remote's fast-forward key to the emulator
**Expected:** The emulator's keyboard mapping covers the TV remote keys
**Actual:** There is no key on the emulator keyboard that sends the media fast-forward key, so the FF skip could not be triggered from the keyboard.
**Severity:** Low
**Workaround:** `adb shell input keyevent 90` (`KEYCODE_MEDIA_FAST_FORWARD`) from a terminal.
**Suggested improvement:** Map the media keys to something in the emulator's extended controls.

**Task:** Launch the app from `run_demo.ps1`
**Expected:** `adb shell monkey -p com.example.whatdidimiss -c android.intent.category.LEANBACK_LAUNCHER 1` opens the app
**Actual:** Sometimes the TV launcher stayed in front and the app was running behind it.
**Severity:** Low
**Workaround:** `adb shell am start -n com.example.whatdidimiss/.MainActivity` was reliable. (The script still uses `monkey`; use the `am start` line if the launcher stays on top.)
**Suggested improvement:** Switch the script to `am start -n`.
