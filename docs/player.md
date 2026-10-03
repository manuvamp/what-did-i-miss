# Player

## Technology

- **Media3 ExoPlayer** for HLS playback
- **Media3 MediaSession** for Fire TV integration
- **Kotlin** for all app code

## PlayerManager

The `PlayerManager` class owns the ExoPlayer instance and provides a clean API:

```kotlin
playerManager.play()
playerManager.pause()
playerManager.seekTo(positionMs)
playerManager.getCurrentPosition()
playerManager.getDuration()
playerManager.getCurrentMediaId()
```

## Playback State

The app maintains a `PlaybackSnapshot` updated every 500ms:

```kotlin
data class PlaybackSnapshot(
    val contentId: String,
    val positionMs: Long,
    val durationMs: Long,
    val isPlaying: Boolean,
    val playbackSpeed: Float,
    val title: String
)
```

Position is polled, not pushed, because:
- ExoPlayer's `currentPosition` is the ground truth
- 500ms is frequent enough for UI updates
- 500ms is infrequent enough to avoid battery drain

## MediaSession

A `MediaSession` is required for Fire TV multimedia apps. It enables:
- remote control transport (play/pause/seek)
- lock screen / notification controls
- voice control (future)

The session is:
- active while the app is playing
- updated with current metadata
- released in `onDestroy()`

## HLS Playback

The player loads an HLS master playlist:

```kotlin
val mediaItem = MediaItem.Builder()
    .setUri(hlsUrl)
    .setMediaId(contentId)
    .build()

val mediaSource = HlsMediaSource.Factory(dataSourceFactory)
    .createMediaSource(mediaItem)

player.setMediaSource(mediaSource)
player.prepare()
player.play()
```

## Subtitles

WebVTT subtitles are delivered as part of the HLS stream. Media3 handles:
- subtitle rendering
- language selection
- cue timing

The app also parses the same subtitle file offline for retrieval purposes.

## Seek Detection

The player detects forward seeks (>10 seconds) and records them as `MissedRange` with reason `FORWARD_SEEK`. This allows the recap to prioritize the skipped section rather than blindly using five minutes.

## Lifecycle

- `onCreate()`: initialize player, load stream, start playback
- `onDestroy()`: release MediaSession, release ExoPlayer

## Fire TV Requirements

The app follows Amazon's multimedia app requirements:
- correct MediaSession/playback-state handling
- proper audio focus management
- lifecycle-aware resource management
- remote control support (D-pad, select, back)
