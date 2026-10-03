package com.example.whatdidimiss.questions

import com.example.whatdidimiss.networking.ApiClient
import com.example.whatdidimiss.networking.QuestionRequest
import com.example.whatdidimiss.networking.QuestionResponse
import com.example.whatdidimiss.player.PlayerManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed class QuestionState {
    object Idle : QuestionState()
    object Loading : QuestionState()
    data class Success(val question: String, val answer: String) : QuestionState()
    data class Error(val message: String) : QuestionState()
}

/**
 * Follow-up question engine. Uses the same spoiler-safe backend retrieval
 * as the recap path; chips map to preset questions (no voice dependency).
 */
class QuestionController(
    private val playerManager: PlayerManager,
    private val apiClient: ApiClient
) {
    private val scope = CoroutineScope(Dispatchers.Main)

    private val _questionState = MutableStateFlow<QuestionState>(QuestionState.Idle)
    val questionState: StateFlow<QuestionState> = _questionState

    // Intent model: what chips are offered per ViewerIntent
    val chips = listOf(
        "Why is that important?",
        "What clues do we know?",
        "Who is involved?",
        "What happened earlier?"
    )

    fun ask(question: String) {
        val snapshot = playerManager.playbackSnapshot.value ?: return
        _questionState.value = QuestionState.Loading

        scope.launch {
            val result: Result<QuestionResponse> = withContext(Dispatchers.IO) {
                runCatching {
                    apiClient.askQuestion(
                        QuestionRequest(
                            contentId = snapshot.contentId,
                            question = question,
                            currentPositionMs = snapshot.positionMs
                        )
                    )
                }
            }

            _questionState.value = result.fold(
                onSuccess = { QuestionState.Success(question, it.answer) },
                onFailure = {
                    QuestionState.Error("Couldn't answer right now — backend unavailable.")
                }
            )
        }
    }

    fun reset() {
        _questionState.value = QuestionState.Idle
    }
}
