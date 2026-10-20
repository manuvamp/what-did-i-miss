# 90-Second Demo Script — Sintel

Shot on the Android TV emulator `tv1080` (API 33, x86).
Backend running on the host on port 3100 (the app reaches it as `http://10.0.2.2:3100`), Sintel served as the 720p copy at `/hls/sintel-720/index.m3u8`. `scriptsun_demo.ps1` sets all of this up. The demo was run on the emulator, not on a physical Fire TV.

Key Sintel beats used below (timestamps are film time; every one was checked against the frames, see
`content/sintel/ANALYSIS_NOTES.md`):
- Opening fight       : 0:12–0:50 (hooded Sintel is attacked by a bald, bearded man in the snow and ends up on her back)
- Little dragon bond  : 2:30–3:03 (Sintel finds a little winged creature with a bloodied wing on a rooftop, holds out her hand, then holds it in her lap)
- Much larger dragon  : 4:42–5:20 (a much larger dragon flies in above the rooftops; Sintel is alarmed, then angry)
- Long journey        : 5:18–6:44 (dusk plain, desert, bamboo forest, rocky canyon, misty mountains, snow)
- Tent, disc, tree    : 6:48–7:31 (the tent again; a disc engraved with a tree; a lone tree on a dark hillside)
- Cave and the fight  : 7:32–9:38 (crystal cave, enormous dragon, fire, fight, Sintel grips a dagger)
- The twist           : 10:06 (journey images flash behind Sintel's red-tinted face: the fallen dragon is Scales, grown up); reveal events unlock at 10:22

The film has no dialogue or subtitles, so every caption describes only what is on screen.

---

## 0:00–0:15 — Normal playback
- Launch the app from the TV launcher. Sintel starts playing.
- The debug overlay (title, position, duration, current scene) is on when playback starts; press **MENU** to hide or show it. It proves the app knows the precise playback state.
- VO: "This is What Did I Miss, a story-aware assistant for TV. Here Sintel is alone in the snow, and someone attacks her."

## 0:15–0:30 — Lose track / skip ahead
- Press FF (media fast-forward, 15 s per press) about 18 times to jump from ~2:00 to ~6:30. The emulator keyboard has no FF key, so send it with `adb shell input keyevent 90`. The presses merge into one skip.
- VO: "Say you looked away — or skipped ahead — right past the part where she finds a wounded little dragon and a much larger dragon appears."

## 0:30–0:50 — Press the button -> spoiler-safe recap
- Press the recap trigger (M, INFO or the on-screen **What did I miss?** button). The video pauses and the recap card opens. (MENU only toggles the debug overlay.)
- Card reads "You missed 4 min 30 sec" + a summary covering exactly the skipped window (wounded little dragon on the rooftop, Sintel holding it, the much larger dragon, Sintel's angry stare, the start of her journey), + an IMPORTANT clue.
- VO: "It knows where you are, what just happened, and — crucially — what it is *allowed* to tell you."
- Call out: the recap mentions nothing about the dragon in the cave or the 10:06 twist. For real frames from the film, press **2**, **5** or **0** (or the Last 2 / 5 / 10 min buttons) to play the visual recap: up to three key moments, each with a frame and a story caption.

## 0:50–1:05 — Clue chip
- Move focus to **"What clues do we know?"** and select.
- It lists only clues discovered before the current position (Staff with a Round Engraved End, A Wounded Little Dragon, A Much Larger Dragon) — no late clues such as the tree on the disc, the enormous dragon in the cave or the twist.
- VO: "Every answer is bounded by your exact timestamp."

## 1:05–1:20 — Watch Missed Part
- Move focus to **"Watch Missed Part"** and select.
- Player seeks back to the start of the skipped range and resumes.
- VO: "Or just watch the part you missed — it jumps to the exact spot."

## 1:20–1:30 — Architecture flash
- Cut to the architecture slide while playback continues.
- VO: "Under the hood: a retrieval layer that filters everything by your timestamp, a SpoilerGuard that checks the generated answer for leaks, and a deterministic recap engine that needs no AI key and takes over if an AI provider fails. Your movie remembers what you forgot — and never spoils what comes next."

---

### Alternate closing (if showing the twist, DO NOT do this before reveal)
Record a second pass at ~10:30 (the reveal events unlock at 10:22, after the 10:06 beat has played), showing the recap *now* allowed to say the fallen dragon is Scales, grown up — demonstrating the spoiler boundary unlocks at the right moment. Showing the recap at ~9:50 (dragon lying on the cave floor) instead proves it stays quiet right up to the reveal.
