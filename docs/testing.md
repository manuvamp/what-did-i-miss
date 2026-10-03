# Testing

## Test Categories

### 1. Spoiler Tests

Located in `tests/spoiler/`. These are hard-failure tests.

- **Test 1**: At position 10:00, no context after 10:00 is retrievable.
- **Test 2**: At position 42:37, a future clue at 46:00 must not appear.
- **Test 3**: A later character reveal must not be exposed early.

### 2. Retrieval Tests

Located in `tests/retrieval/`.

- subtitle window filtering
- scene identification
- event retrieval within window
- clue discovery up to position
- character list construction
- prior context relevance

### 3. Player Tests

- play / pause / seek / resume
- app backgrounding / foregrounding
- HOME button behavior
- remote control input
- MediaSession state

### 4. Subtitle Tests

- exact timestamp alignment
- missing cues
- overlapping cues
- multiple languages

### 5. API Tests

- valid JSON responses
- schema conformance
- error handling
- malformed request rejection

### 6. Failure Tests

Force these conditions:
- AI timeout
- network failure
- invalid JSON from AI
- missing subtitles
- missing story index
- rapid repeated recap clicks

The application must not crash.

## Running Tests

```bash
# Backend tests
cd backend
npm test

# Content validation
npm run validate:content -- content/last-signal

# Spoiler regression tests
npx vitest tests/spoiler/
```

## Gold Standard Dataset

`tests/story/` contains expected values:

```json
{
  "position": "00:10:00",
  "allowedClues": ["broken_window", "missing_key"],
  "forbiddenClues": ["photograph", "hidden_room"]
}
```

## Manual Fire TV Testing

1. Install debug APK on Fire TV device or simulator
2. Verify video plays smoothly
3. Verify subtitles are synchronized
4. Press **WHAT DID I MISS?** and confirm overlay appears
5. Select **Continue Watching** and confirm playback resumes at exact position
6. Select **Watch Missed Part** and confirm seek to missed range start
7. Test D-pad navigation through all focusable elements
