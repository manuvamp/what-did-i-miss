package com.example.whatdidimiss.player

data class PlaybackSnapshot(
    val contentId: String,
    val positionMs: Long,
    val durationMs: Long,
    val isPlaying: Boolean,
    val playbackSpeed: Float,
    val title: String,
    val episodeId: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null
)

data class MissedRange(
    val startMs: Long,
    val endMs: Long,
    val reason: MissedReason
)

enum class MissedReason {
    DEFAULT_WINDOW,
    FORWARD_SEEK,
    RESUME,
    MANUAL
}
