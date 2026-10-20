package com.example.whatdidimiss.recap

import com.example.whatdidimiss.networking.ApiClient
import com.example.whatdidimiss.networking.RecapRequest
import com.example.whatdidimiss.networking.RecapResponse
import com.example.whatdidimiss.player.ContentIndex
import com.example.whatdidimiss.player.MissedRange
import com.example.whatdidimiss.player.PlayerManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed class RecapState {
    object Idle : RecapState()
    object Loading : RecapState()
    /** [visualWindowMs] is set when the viewer asked for a 2/5/10 min visual recap. */
    data class Success(
        val response: RecapResponse,
        val missedRange: MissedRange,
        val visualWindowMs: Long? = null
    ) : RecapState()
    data class Offline(val summary: String, val missedRange: MissedRange) : RecapState()
}

class RecapController(
    private val playerManager: PlayerManager,
    private val apiClient: ApiClient,
    private val contentIndex: ContentIndex
) {
    private val scope = CoroutineScope(Dispatchers.Main)

    private val _recapState = MutableStateFlow<RecapState>(RecapState.Idle)
    val recapState: StateFlow<RecapState> = _recapState

    /**
     * With [visualWindowMs] null, recaps the skipped range (or the default
     * window). Otherwise recaps exactly the last [visualWindowMs] and asks the
     * UI to play the visual montage first.
     */
    fun requestRecap(visualWindowMs: Long? = null) {
        val snapshot = playerManager.playbackSnapshot.value ?: return
        val missedRange = visualWindowMs?.let { playerManager.windowRange(it) }
            ?: playerManager.calculateMissedRange()

        playerManager.pause()
        if (missedRange.endMs <= missedRange.startMs) {
            _recapState.value = RecapState.Offline("Nothing to recap yet: the film has only just started.", missedRange)
            return
        }
        _recapState.value = RecapState.Loading

        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    apiClient.getRecap(
                        RecapRequest(
                            contentId = snapshot.contentId,
                            // The snapshot updates on a timer and can lag the range end,
                            // which the backend rejects; the range end is "now".
                            currentPositionMs = maxOf(snapshot.positionMs, missedRange.endMs),
                            windowStartMs = missedRange.startMs,
                            windowEndMs = missedRange.endMs
                        )
                    )
                }
            }

            _recapState.value = result.fold(
                onSuccess = { RecapState.Success(it, missedRange, visualWindowMs) },
                onFailure = {
                    // Offline fallback: scene summary + last dialogue lines from bundled index
                    val offline = contentIndex.offlineRecap(missedRange.startMs, missedRange.endMs)
                    RecapState.Offline(offline, missedRange)
                }
            )
        }
    }

    fun dismissRecap() {
        _recapState.value = RecapState.Idle
        playerManager.play()
    }

    fun watchMissedPart() {
        when (val state = _recapState.value) {
            is RecapState.Success -> seekToRange(state.missedRange)
            is RecapState.Offline -> seekToRange(state.missedRange)
            else -> Unit
        }
    }

    private fun seekToRange(range: MissedRange) {
        playerManager.seekTo(range.startMs)
        playerManager.play()
        _recapState.value = RecapState.Idle
    }
}
