package com.example.whatdidimiss.player

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

data class SubtitleCue(
    val id: String,
    val startMs: Long,
    val endMs: Long,
    val text: String,
    val speaker: String? = null,
    val sceneId: String? = null
)

data class Scene(
    val id: String,
    val startMs: Long,
    val endMs: Long,
    val title: String,
    val summary: String,
    val characters: List<String>,
    val locations: List<String>,
    val importantObjects: List<String>,
    val events: List<String>,
    val clues: List<String>,
    val questionsRaised: List<String>,
    val questionsResolved: List<String>
)

/**
 * Loads the local content index (scenes + subtitles) bundled as app assets.
 * This is the offline fallback path: even with no network, the app can
 * identify the current scene and build a basic recap.
 */
class ContentIndex(context: Context) {

    var scenes: List<Scene> = emptyList()
        private set
    var subtitles: List<SubtitleCue> = emptyList()
        private set

    init {
        val gson = Gson()
        try {
            context.assets.open("content/scenes.json").bufferedReader().use { reader ->
                val type = object : TypeToken<List<Scene>>() {}.type
                scenes = gson.fromJson(reader, type)
            }
        } catch (_: Exception) {}
        try {
            context.assets.open("content/subtitles.json").bufferedReader().use { reader ->
                val type = object : TypeToken<List<SubtitleCue>>() {}.type
                subtitles = gson.fromJson(reader, type)
            }
        } catch (_: Exception) {}
    }

    fun sceneAt(positionMs: Long): Scene? =
        scenes.firstOrNull { positionMs >= it.startMs && positionMs < it.endMs }

    fun sceneNumberAt(positionMs: Long): Int {
        val idx = scenes.indexOfFirst { positionMs >= it.startMs && positionMs < it.endMs }
        return if (idx >= 0) idx + 1 else -1
    }

    fun cuesInWindow(startMs: Long, endMs: Long): List<SubtitleCue> =
        subtitles.filter { it.endMs > startMs && it.startMs < endMs }

    /**
     * Deterministic offline recap used when the backend is unavailable.
     * Summaries of scenes that finished inside the window + the last few dialogue
     * lines, no future data. The scene still playing gets its title only: its
     * summary covers parts the viewer hasn't seen yet (and can name a twist).
     */
    fun offlineRecap(startMs: Long, endMs: Long): String {
        val finished = scenes.filter { it.endMs > startMs && it.endMs <= endMs }.takeLast(2)
        val current = sceneAt(endMs)
        val cues = cuesInWindow(startMs, endMs).takeLast(4)
        val parts = mutableListOf<String>()
        finished.forEach { parts.add("In ${it.title}: ${it.summary}") }
        if (current != null) parts.add("Now: ${current.title}.")
        if (cues.isNotEmpty()) {
            parts.add(
                "Recent lines: " + cues.joinToString(" ") {
                    "${it.speaker ?: "Someone"} said \"${it.text}\""
                }
            )
        }
        return parts.joinToString("\n\n").ifBlank {
            "No indexed story data is available for this section."
        }
    }
}
