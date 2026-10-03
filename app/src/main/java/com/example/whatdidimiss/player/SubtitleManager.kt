package com.example.whatdidimiss.player

import androidx.media3.common.Player
import androidx.media3.common.text.CueGroup
import androidx.media3.exoplayer.ExoPlayer

/**
 * Tracks Media3 subtitle track state for diagnostics: whether a text track
 * is selected and what cue is currently displayed.
 */
class SubtitleManager(private val player: ExoPlayer) {

    @Volatile
    var currentCueText: String? = null
        private set

    @Volatile
    var subtitleTrackSelected: Boolean = false
        private set

    private val listener = object : Player.Listener {
        override fun onCues(cueGroup: CueGroup) {
            currentCueText = cueGroup.cues.firstOrNull()?.text?.toString()
        }

        override fun onTracksChanged(tracks: androidx.media3.common.Tracks) {
            subtitleTrackSelected = tracks.groups.any { group ->
                group.type == androidx.media3.common.C.TRACK_TYPE_TEXT && group.isSelected
            }
        }
    }

    fun attach() = player.addListener(listener)
    fun detach() = player.removeListener(listener)
}
