# Player

## Technology

- **Media3 ExoPlayer 1.2.1** for HLS playback
- **`MediaSessionCompat`** (androidx.media) bridged to ExoPlayer for transport controls
- **Kotlin**, single activity (`MainActivity`), XML layouts with ViewBinding

## PlayerManager

`PlayerManager` owns the ExoPlayer instance and exposes a small API:

```kotlin
playerManager.play()
playerManager.pause()
playerManager.seekTo(positionMs)
playerManager.getCurrentPosition()
playerManager.getDuration()
playerManager.getCurrentMediaId()
playerManager.calculateMissedRange()   // skipped range, or the last 5 minutes
playerManager.windowRange(windowMs)    // exactly the last windowMs
```

## Playback State

The app keeps a `PlaybackSnapshot` (content ID, position, duration, playing flag, speed, title) and refreshes it every 500 ms while the video is playing, and on player events. It is not refreshed while paused, so code that needs "now" for a request must read `getCurrentPosition()` (the recap request sends the larger of the snapshot position and the window end).

Position is polled rather than pushed because ExoPlayer's `currentPosition` is the ground truth and 500 ms is frequent enough for the debug overlay and cheap enough on a TV stick.

## MediaSession

A `MediaSessionCompat` is published so the remote and system UI can send play, pause, rewind, fast-forward and seek commands and read the playback state. It was chosen over the Media3 `MediaSession` to keep a single-activity v1 simple; a move to `Media3SessionService` would be the next step for custom commands. The session is released in `onDestroy()`. Voice control is not implemented.

## HLS Playback

```kotlin
val mediaItem = MediaItem.Builder()
    .setUri(Uri.parse(url))
    .setMediaId(contentId)
    .setMediaMetadata(MediaMetadata.Builder().setTitle(title).build())
    .build()

val mediaSource = HlsMediaSource.Factory(DefaultHttpDataSource.Factory())
    .createMediaSource(mediaItem)
```

The stream URL is set at build time: `-PbackendUrl=...` and `-PstreamPath=...` become `BuildConfig.STREAM_URL = <backendUrl>/hls/<streamPath>/index.m3u8`. The default stream path is `sintel` (full resolution); the emulator demo uses `sintel-720` because the emulator's software H.264 decoder crashes on the 1080p High-profile stream. See the README for how to produce both.

## Subtitles

The app includes subtitle plumbing (a `SubtitleManager` and a subtitle-cue list in the bundled index), but the demo film has no dialogue and the copy used has no audio track, so there are no subtitles to show. Subtitle handling is not exercised by the Sintel demo.

## Seek Detection and Skips

- Any forward seek of more than 10 seconds (reason `DISCONTINUITY_REASON_SEEK`) is recorded as a `MissedRange` with reason `FORWARD_SEEK`.
- FF and REW on the remote jump 15 seconds. A further forward skip that starts within 5 seconds of the previous skip's end extends the same range, so several quick presses count as one skip.
- A recorded skip is used for "What did I miss?" while the viewer has watched less than a minute past its end. After that, the recap falls back to the last 5 minutes (reason `DEFAULT_WINDOW`).
- The 2 / 5 / 0 keys ignore any skip and recap exactly the last 2 / 5 / 10 minutes (reason `MANUAL`).

## Visual Recap

When a visual recap is requested, the backend returns up to three key moments, each with a story caption and a frame URL. `MainActivity` downloads the frames from the backend, shows each for 3.5 seconds with a slow zoom and a progress bar, then lands on the text recap card. OK or right moves to the next moment; BACK skips to the card.

## Lifecycle

- `onCreate()`: initialize the player, load the stream, set up the media session and the key handling
- `onPause()` / `onResume()`: forwarded to the `PlayerView`
- `onDestroy()`: cancel the montage, release the media session and ExoPlayer

## Fire TV Notes

The app declares the leanback feature (not required, so it also installs on non-TV devices), has a `LEANBACK_LAUNCHER` intent filter, does not require a touchscreen, and is operable with the D-pad, OK, BACK, MENU and the media keys. It has been run on the Android TV emulator only; it has not been checked against Amazon's app-submission requirements (for example audio-focus handling) or run on a Fire TV device.
