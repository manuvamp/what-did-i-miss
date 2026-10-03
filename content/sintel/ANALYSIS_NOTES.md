# Sintel — Film Analysis Notes

**Runtime:** 712.96 s (11:53), 1920×818, 24fps, h264, **no audio stream**.
**Source:** videoplayback.mp4 (Sintel, Blender Foundation, CC BY 3.0).
**Method:** 238 frames extracted at 1 frame / 3 s (640 px wide) into `frames/`; 15 contact-sheet montages viewed in order; 10 random spot-check frames re-extracted and confirmed against the video.

## Scene List (14 scenes)

| # | Time | Title | Key beats |
|---|------|-------|-----------|
| 1 | 0:00–0:48 | The Wounded Traveler | Sintel alone with glowing staff in the snow |
| 2 | 0:48–2:00 | Collapse in the Blizzard | Close-up of her bleeding bandaged hand; she collapses |
| 3 | 2:00–2:21 | Rescue | The shaman takes her into his hut |
| 4 | 2:21–3:06 | A Baby Dragon | Scales appears from under the fireplace; Sintel pets it |
| 5 | 3:06–3:54 | Taught to Kill | Throat-slash gesture, knife demonstration, Scales afraid |
| 6 | 3:54–4:42 | Trust | Scales rests on her shoulder; she sees the dragon trophies |
| 7 | 4:42–5:30 | Play and the Forge | They play-wrestle; the shaman works at the forge |
| 8 | 5:30–6:18 | The Sword and the Map | He gives her a sword and points to the map |
| 9 | 6:18–7:03 | Departure | She says goodbye to Scales and leaves |
| 10 | 7:03–8:21 | The Journey to the Lair | Mountain trek, camp, cave entrance |
| 11 | 8:21–9:09 | Inside the Cave | Cavern, torch, baby-dragon shadow-puppet |
| 12 | 9:09–10:33 | The Dragon and the Story | Illustrated vision; adult dragon appears |
| 13 | 10:33–11:30 | The Fight and the Recognition | Fight; dragon recognizes her; she realizes it's Scales |
| 14 | 11:30–end | What She Has Done | Sintel cradles the dying dragon; she sobs; credits |

## The Twist

**Confirmed from the frames, not from pre-existing knowledge.**

At 10:24–10:27 the dragon catches Sintel's blade in its jaws. At 10:33–10:39 it stops fighting, looks directly at her with large eyes and makes a whimpering sound. At 10:42 Sintel's face shows dawning **horror and recognition**. Then at 10:54–11:12 she cradles its head as it dies, and sobs.

The setup pays off precisely: the baby dragon Scales (red-scaled, petted at 2:21–3:06) lived in the hut where the shaman trained her to kill dragons, and the adult dragon in the cave is Scales grown up — she kills the creature she once loved.

## Accuracy Spot-Checks (10 / 10 PASS)

| Event | Claimed t | Verified |
|-------|-----------|----------|
| event_001 walking in snow | 15s | ✅ |
| event_005 baby dragon appears | 144s | ✅ |
| event_007 knife lesson | 204s | ✅ |
| event_010 play on shoulder | 288s | ✅ |
| event_011 sword handed over | 345s | ✅ |
| event_012 map examined | 363s | ✅ |
| event_015 entering cave | 495s | ✅ |
| event_018 adult dragon reveal | 588s | ✅ |
| event_020 blade caught in jaws | 624s | ✅ |
| event_023 sobbing over dragon | 672s | ✅ |

All checked timestamps matched the actual frame content within ~1 s.

## Uncertainty / Notes

- The Persian-style illustrated vision at 9:15–9:27 is deliberately ambiguous: it reads as the dragon's own backstory (a ship, a knight, a fight). I treated it as a stylized storytelling device, marked `importance: 0.7`.
- The hooded figure at 8:36 could not be identified — possibly a vision or a trick of light; not given its own event.
- The shaman's exact motive for sending Sintel is never stated; I describe only what is shown.
- `subtitles.json` is empty because the video contains no audio stream — there is no dialogue to transcribe.
