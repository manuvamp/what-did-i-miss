# 90-Second Demo Script — Sintel

Shot on the Android TV emulator `tv1080` (or a Fire TV stick if available).
Backend running on the host (`http://10.0.2.2:3000`), Sintel served at `/hls/sintel/index.m3u8`.

Key Sintel beats used below:
- Scales bond : 2:21–3:06 (Sintel pets the baby dragon)
- Sword + map : 5:30–6:18 (shaman sends her to kill a dragon)
- The fight   : 10:33–11:30 (the twist: the adult dragon is Scales)

---

## 0:00–0:15 — Normal playback
- Launch the app from the TV launcher. Sintel starts playing.
- Press **MENU** once to flash the debug overlay: title, position, duration, current scene — proving precise playback state.
- VO: "This is What Did I Miss, a story-aware assistant for TV. Here Sintel is travelling through the snow."

## 0:15–0:30 — Lose track / skip ahead
- Use D-pad right / MEDIA_FAST_FORWARD to jump from ~2:00 to ~6:30.
- VO: "Say you looked away — or skipped ahead — right past the part where she bonded with the dragon and was sent to kill one."

## 0:30–0:50 — Press the button -> spoiler-safe recap
- Press the recap trigger (MENU / INFO / M). Video dims, overlay opens.
- Overlay reads: "You missed ~4 min" + a summary covering exactly the skipped window, + an IMPORTANT clue.
- VO: "It knows where you are, what just happened, and — crucially — what it is *allowed* to tell you."
- Call out: the recap connects the sword/map to the earlier Scales bond **without** revealing the 10:33 twist.

## 0:50–1:05 — Clue chip
- Move focus to **"What clues do we know?"** and select.
- It lists only clues discovered before the current position (e.g. Scales Lives With the Shaman, The Map to the Dragon) — no late clues.
- VO: "Every answer is bounded by your exact timestamp."

## 1:05–1:20 — Watch Missed Part
- Move focus to **"Watch Missed Part"** and select.
- Player seeks back to the start of the skipped range and resumes.
- VO: "Or just watch the part you missed — it jumps to the exact spot."

## 1:20–1:30 — Architecture flash
- Cut to the architecture slide while playback continues.
- VO: "Under the hood: a retrieval layer that filters everything by your timestamp, a SpoilerGuard that checks the generated answer for leaks, and a deterministic fallback so it works even offline. Your movie remembers what you forgot — and never spoils what comes next."

---

### Alternate closing (if showing the twist, DO NOT do this before reveal)
Record a second pass at ~10:50, after the recognition, showing the recap *now* allowed to say the dragon is Scales — demonstrating the spoiler boundary unlocks at the right moment.
