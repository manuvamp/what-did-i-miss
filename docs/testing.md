# Testing

## What is automated

`cd backend && npx vitest run` runs 30 tests in 4 files (all passing as of 2026-10-20), plus `npx tsc --noEmit` for types. The test files are in `tests/` and are picked up by `backend/vitest.config.ts`. They use the deterministic provider, so they need no keys or network.

| File | Tests | Content used | What it checks |
|------|-------|--------------|----------------|
| `tests/spoiler/spoiler.test.ts` | 8 | `content/last-signal/` (fictional fixture) | Nothing after the position is retrievable; a late clue and a late character reveal stay hidden; character facts and object changes are time-filtered; SpoilerGuard catches future references and passes safe text; prior context never references the future |
| `tests/spoiler/sintel-spoiler.test.ts` | 7 | `content/sintel/` | Recaps and highlights at 5:00 and 10:15 do not reveal the twist; retrieval at 10:00 and 10:15 excludes the reveal events (boundary 622 s) and at 10:25 includes them |
| `tests/retrieval/retrieval.test.ts` | 9 | `content/last-signal/` | Window filtering, current scene, events and clues up to the position, characters, prior context, story state, frame selection, empty result before any content |
| `tests/api/api.test.ts` | 6 | `content/last-signal/` | Recap service output shape, caching, early-window safety, and the follow-up answers (clues, why it matters, who is involved) |

The fictional index exists as a fixture because those tests were written first. The Sintel index is covered by the Sintel spoiler tests and by the content validator:

```bash
cd backend
npm run validate:content -- ../content/sintel     # required fields, timestamps, cross-references (0 errors, 0 warnings on 2026-10-20)
```

## What is not automated

- **The Android app has no unit or UI tests.** It is checked by hand (below).
- **The Anthropic and Bedrock providers** are not tested, with or without live keys.
- **Failure modes** (AI timeout, invalid JSON from the AI, network loss, rapid repeated recap presses) have no dedicated tests. The backend falls back to the deterministic provider when a provider throws, and the app shows an offline summary if the backend is unreachable, but those paths were exercised by hand at most.
- **Subtitles** (alignment, overlapping cues, multiple languages) are not tested with real data; Sintel has none.
- **The offline fallback in the app** is not spoiler-checked and has no test (see README, "Known limitations").

## Manual testing (Android TV emulator)

The full checklist is in `RUNBOOK.md`, section 5. In short:

1. Start the backend and the emulator (`scripts\run_demo.ps1`).
2. The film plays; MENU toggles the debug overlay.
3. Skip with FF, press M (or INFO), and confirm the recap covers the skipped range.
4. Check Continue Watching, Watch Missed Part, the follow-up chips, and the 2 / 5 / 0 visual recaps.
5. Check the D-pad moves focus across every button and chip, and BACK dismisses the card.
6. Check the twist: at about 10:15 nothing reveals it; at about 10:30 it may.

This has been done on the emulator only. It has not been repeated on a physical Fire TV.
