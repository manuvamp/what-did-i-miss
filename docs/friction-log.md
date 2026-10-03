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

(no production entries yet — the Live App has not yet been built or run on hardware)
