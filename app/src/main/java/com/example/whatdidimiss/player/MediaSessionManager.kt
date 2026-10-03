package com.example.whatdidimiss.player

import android.content.Context
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.common.Player

/**
 * Maintains a MediaSession in sync with ExoPlayer.
 * Fire TV multimedia apps are required to publish a correct MediaSession so
 * remote transport controls (play/pause/rew/ff) and system media UI work.
 */
class MediaSessionManager(
    context: Context,
    private val player: ExoPlayer
) {
    val session: MediaSessionCompat = MediaSessionCompat(context, "WhatDidIMissSession")

    private val callback = object : MediaSessionCompat.Callback() {
        override fun onPlay() = player.play()
        override fun onPause() = player.pause()
        override fun onSeekTo(pos: Long) = player.seekTo(pos)
        override fun onRewind() = player.seekTo((player.currentPosition - 10_000).coerceAtLeast(0))
        override fun onFastForward() =
            player.seekTo((player.currentPosition + 10_000).coerceAtMost(player.duration.coerceAtLeast(0)))
        override fun onStop() = player.pause()
    }

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) = publish()
        override fun onPlaybackStateChanged(playbackState: Int) = publish()
        override fun onEvents(player: Player, events: Player.Events) {
            if (events.contains(Player.EVENT_POSITION_DISCONTINUITY)) publish()
        }
    }

    init {
        session.setCallback(callback)
        session.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        )
        session.isActive = true
        player.addListener(playerListener)
        publish()
    }

    private fun publish() {
        val state = when {
            player.playbackState == Player.STATE_ENDED -> PlaybackStateCompat.STATE_STOPPED
            player.isPlaying -> PlaybackStateCompat.STATE_PLAYING
            player.playbackState == Player.STATE_BUFFERING -> PlaybackStateCompat.STATE_BUFFERING
            else -> PlaybackStateCompat.STATE_PAUSED
        }

        val actions = PlaybackStateCompat.ACTION_PLAY or
            PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_PLAY_PAUSE or
            PlaybackStateCompat.ACTION_SEEK_TO or
            PlaybackStateCompat.ACTION_REWIND or
            PlaybackStateCompat.ACTION_FAST_FORWARD or
            PlaybackStateCompat.ACTION_STOP

        val playbackState = PlaybackStateCompat.Builder()
            .setState(state, player.currentPosition, player.playbackParameters.speed)
            .setActions(actions)
            .build()

        session.setPlaybackState(playbackState)
    }

    fun release() {
        player.removeListener(playerListener)
        session.isActive = false
        session.release()
    }
}
