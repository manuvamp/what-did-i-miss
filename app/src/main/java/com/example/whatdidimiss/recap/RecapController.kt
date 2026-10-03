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
    data class Success(val response: RecapResponse, val missedRange: MissedRange) : RecapState()
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

    fun requestRecap() {
        val snapshot = playerManager.playbackSnapshot.value ?: return
        val missedRange = playerManager.calculateMissedRange()

        playerManager.pause()
        _recapState.value = RecapState.Loading

        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    apiClient.getRecap(
                        RecapRequest(
                            contentId = snapshot.contentId,
                            currentPositionMs = snapshot.positionMs,
                            windowStartMs = missedRange.startMs,
                            windowEndMs = missedRange.endMs
                        )
                    )
                }
            }

            _recapState.value = result.fold(
                onSuccess = { RecapState.Success(it, missedRange) },
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
