package com.example.whatdidimiss.player

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.common.MediaMetadata
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class PlayerManager(private val context: Context) {

    private var player: ExoPlayer? = null
    private var positionJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main)

    private val _playbackSnapshot = MutableStateFlow<PlaybackSnapshot?>(null)
    val playbackSnapshot: StateFlow<PlaybackSnapshot?> = _playbackSnapshot

    private val _missedRange = MutableStateFlow<MissedRange?>(null)
    val missedRange: StateFlow<MissedRange?> = _missedRange

    private var lastPositionMs = 0L
    private var isUserSeeking = false

    var onPlayerReady: (() -> Unit)? = null
    var onPlayerError: ((String) -> Unit)? = null

    fun initializePlayer(): ExoPlayer {
        if (player == null) {
            player = ExoPlayer.Builder(context).build().apply {
                addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        when (playbackState) {
                            Player.STATE_READY -> onPlayerReady?.invoke()
                            Player.STATE_ENDED -> stopPositionUpdates()
                        }
                        updateSnapshot()
                    }

                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        updateSnapshot()
                        if (isPlaying) {
                            startPositionUpdates()
                        } else {
                            stopPositionUpdates()
                        }
                    }

                    override fun onPositionDiscontinuity(
                        oldPosition: Player.PositionInfo,
                        newPosition: Player.PositionInfo,
                        reason: Int
                    ) {
                        if (reason == Player.DISCONTINUITY_REASON_SEEK) {
                            handleSeek(oldPosition.positionMs, newPosition.positionMs)
                        }
                        updateSnapshot()
                    }

                    override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                        onPlayerError?.invoke(error.message ?: "Unknown playback error")
                    }
                })
            }
        }
        return player!!
    }

    fun loadHlsStream(url: String, contentId: String, title: String) {
        val mediaItem = MediaItem.Builder()
            .setUri(Uri.parse(url))
            .setMediaId(contentId)
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(title)
                    .build()
            )
            .build()

        val dataSourceFactory = DefaultHttpDataSource.Factory()
        val mediaSource: MediaSource = HlsMediaSource.Factory(dataSourceFactory)
            .createMediaSource(mediaItem)

        player?.apply {
            setMediaSource(mediaSource)
            prepare()
        }
    }

    fun play() {
        player?.play()
    }

    fun pause() {
        player?.pause()
    }

    fun seekTo(positionMs: Long) {
        player?.seekTo(positionMs)
    }

    fun getCurrentPosition(): Long = player?.currentPosition ?: 0L

    fun getDuration(): Long = player?.duration ?: 0L

    fun getCurrentMediaId(): String? = player?.currentMediaItem?.mediaId

    fun isPlaying(): Boolean = player?.isPlaying ?: false

    fun getPlaybackSpeed(): Float = player?.playbackParameters?.speed ?: 1.0f

    private fun startPositionUpdates() {
        positionJob?.cancel()
        positionJob = scope.launch {
            while (true) {
                updateSnapshot()
                delay(500)
            }
        }
    }

    private fun stopPositionUpdates() {
        positionJob?.cancel()
    }

    private fun updateSnapshot() {
        val currentPlayer = player ?: return
        val mediaItem = currentPlayer.currentMediaItem ?: return

        _playbackSnapshot.value = PlaybackSnapshot(
            contentId = mediaItem.mediaId,
            positionMs = currentPlayer.currentPosition,
            durationMs = currentPlayer.duration,
            isPlaying = currentPlayer.isPlaying,
            playbackSpeed = currentPlayer.playbackParameters.speed,
            title = mediaItem.mediaMetadata.title?.toString() ?: "Unknown"
        )
    }

    private fun handleSeek(oldPositionMs: Long, newPositionMs: Long) {
        if (newPositionMs > oldPositionMs + 10000) {
            _missedRange.value = MissedRange(
                startMs = oldPositionMs,
                endMs = newPositionMs,
                reason = MissedReason.FORWARD_SEEK
            )
        }
    }

    fun calculateMissedRange(windowMs: Long = 300_000): MissedRange {
        val currentPosition = getCurrentPosition()
        val existingMissed = _missedRange.value

        return if (existingMissed != null && existingMissed.endMs == currentPosition) {
            existingMissed
        } else {
            MissedRange(
                startMs = maxOf(0, currentPosition - windowMs),
                endMs = currentPosition,
                reason = MissedReason.DEFAULT_WINDOW
            )
        }
    }

    fun release() {
        stopPositionUpdates()
        player?.release()
        player = null
    }
}
