# Sintel — Film Analysis Notes

**Runtime:** 712.96 s (11:53), 1920×818, 24 fps, h264, **no audio stream** (so `subtitles.json` is empty).
**Source:** videoplayback.mp4 (Sintel, Blender Foundation, CC BY 3.0).

## Why this index was rewritten (2026-10-14)

The first version of this index was partly invented. It described a forge, a sword and a map ("The Sword and the Map", 5:30–6:18) that are not in this video, and placed other events on the wrong shots: at 345 s the film shows a desert dissolve and then a bamboo forest, not "the shaman presents a sword". Its notes claimed 10/10 spot checks passed; the check images on disk contradicted that. Every scene, event, clue, character fact, object and story state was rebuilt from the frames, describing only what is visible.

## Method

- `frames/seq_NNNN.jpg`, one frame every 3 s, viewed in order, plus extra 1 fps ffmpeg extractions where precision mattered.
- **Frame timing:** `seq_NNNN.jpg` actually shows film time `(NNNN-1)*3 + 1.5` s, not the `(NNNN-1)*3` s that `frames.json` records. Confirmed by PSNR against ffmpeg frames for seq 1, 19, 60, 100, 160 and 200 (peak at +1.5 s each time). The same offset is in the contact-sheet labels and caused part of the old misplacement. `frames.json` timestamps were left as they are; each event's `timestampMs` is set so that the frame the app shows for it (nearest to `timestampMs + 1.5 s`) is the shot the caption describes.

## Scenes (16)

| # | Time | Title |
|---|------|-------|
| 1 | 0:00–1:10 | Attack in the Snow |
| 2 | 1:10–1:58 | Firelit Tent |
| 3 | 1:58–2:26 | City of Rooftops |
| 4 | 2:26–3:10 | A Wounded Little Dragon |
| 5 | 3:10–3:36 | Night in a Cluttered Room |
| 6 | 3:36–4:06 | Market Chase |
| 7 | 4:06–4:42 | Rooftops at Sunset |
| 8 | 4:42–5:18 | A Much Larger Dragon |
| 9 | 5:18–6:24 | A Long Journey |
| 10 | 6:24–6:44 | Back in the Snow |
| 11 | 6:44–7:32 | The Tent Again |
| 12 | 7:32–8:20 | Crystal Cave |
| 13 | 8:20–9:38 | Dragon in the Cave |
| 14 | 9:38–10:05 | The Dragon Falls |
| 15 | 10:05–10:44 | Recognition and Grief |
| 16 | 10:44–11:53 | After the Cave |

28 events, 7 clues, 6 characters, 7 objects, 12 story states.

## Story lines vs descriptions

Each event has two texts. `description` is the frame-level grounding (what is literally on screen). `story` is the short narrative beat viewers see in recaps and the visual montage ("After a brutal fight, Sintel brings the dragon down."). Story lines interpret the shots as plot but stay inside what the frames support; the two that needed checking were confirmed on contact sheets: at ~4:58 the large dragon flies off carrying the little one while Sintel's hand reaches after it, and 9:00–9:50 shows her thrown down repeatedly, gripping her dagger, then the dragon lying in a red pool. The little dragon is called Scales from 3:00 on (the film's name for him); only tying that name to the cave dragon is the spoiler. Clue descriptions are written in the same story voice.

## The twist and spoiler gating

What is on screen at the reveal: Sintel's red-tinted face with journey landscapes dissolving behind it, then an open gloved hand reaching toward the fallen dragon, echoing the hand she held out to the little dragon (~2:48) and toward it in the sky (~4:56). "The fallen dragon is Scales, grown up" rests on those echoes and the film's premise; the name never appears in the video.

Everything that states it is gated to **622 s**: events 024/025 (`spoilerBoundaryMs`), clue_07 (`discoveredAtMs`) and the three character facts (`knownAtMs`). Scene 15 starts at 605 s, so Scales is not in its `characters` list (it would otherwise appear next to "Adult Dragon" before the reveal). Before 622 s the text says "the little dragon" for the rooftop creature and "the enormous dragon" for the cave one. Checked through the API at 615 s and 621 s with 2- and 10-minute windows: no reveal text.

## Spot checks

All 28 events were checked by viewing the ffmpeg frame at `timestampMs + 1.5 s` and the `seq_` frame the app shows. Side-by-side images are in `accuracy/` (ffmpeg left, app frame right). A selection:

| Event | App frame | What is on screen |
|-------|-----------|-------------------|
| 002 | seq_0007 | Bald man and hooded Sintel grappling on a snowy slope |
| 003 | seq_0016 | Sintel on her back in the snow, a pole across her |
| 007 | seq_0051 | Little winged creature with a bloodied wing on cobbles |
| 009 | seq_0061 | Hand on the creature's head, blood next to its wing |
| 012 | seq_0095 | Much larger long-tailed dragon; the small dragon upper left |
| 018 | seq_0148 | Lone tree on a dark hillside |
| 021 | seq_0171 | Horned dragon breathing fire in the cave |
| 023 | seq_0196 | Dragon lying at left with red beneath it, Sintel standing at right |
| 024 | seq_0203 | Wide-eyed red-tinted face, hand at cheek, faint desert behind |
| 025 | seq_0204 | Gloved open hand reaching out in the dark cave |
| 028 | seq_0234 | Tiny Sintel, small tan creature lying down, snowdrops in front |

The highlight frames chosen by the visual recap were also reviewed against their captions for 2-, 5- and 10-minute windows at 7:00, 10:00, 10:40 and 11:40.

## Not sure about

- How Sintel gets from the snow into the tent, and whether the two staffs are the same object.
- Whether the dark-haired hooded traveller at ~6:02–6:14 is Sintel (the text says "hooded traveller").
- What happens to the little dragon after the much larger dragon appears; left as an open question.
- Whether the city dragon and the cave dragon are related, and what the young dragon on the rock is; kept as separate characters.
- Fight details: shots at ~9:15 and ~9:30 show a small tan winged shape that could not be identified, so no caption uses them. No caption claims Sintel kills the dragon or that it dies.
- The small creature in the final shot is unidentified.
