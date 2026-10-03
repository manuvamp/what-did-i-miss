package com.example.whatdidimiss

import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.whatdidimiss.databinding.ActivityMainBinding
import com.example.whatdidimiss.networking.ApiClient
import com.example.whatdidimiss.player.ContentIndex
import com.example.whatdidimiss.player.MediaSessionManager
import com.example.whatdidimiss.player.PlaybackSnapshot
import com.example.whatdidimiss.player.PlayerManager
import com.example.whatdidimiss.player.SubtitleManager
import com.example.whatdidimiss.questions.QuestionController
import com.example.whatdidimiss.questions.QuestionState
import com.example.whatdidimiss.recap.RecapController
import com.example.whatdidimiss.recap.RecapState
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var playerManager: PlayerManager
    private lateinit var recapController: RecapController
    private lateinit var questionController: QuestionController
    private lateinit var contentIndex: ContentIndex
    private var mediaSessionManager: MediaSessionManager? = null
    private var subtitleManager: SubtitleManager? = null

    private val contentId = "last_signal_001"
    private val contentTitle = "The Last Signal"

    // Backend URL — 10.0.2.2 reaches the host from an emulator/simulator;
    // use the LAN IP of the dev machine for a physical Fire TV.
    private val backendBaseUrl = BuildConfig.BACKEND_URL

    // HLS stream — bundled demo or CloudFront URL. Default: public test HLS
    // until "The Last Signal" is packaged (scripts/package_video.sh).
    private val hlsUrl = BuildConfig.STREAM_URL

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        contentIndex = ContentIndex(this)
        playerManager = PlayerManager(this)
        val apiClient = ApiClient(backendBaseUrl)
        recapController = RecapController(playerManager, apiClient, contentIndex)
        questionController = QuestionController(playerManager, apiClient)

        setupPlayer()
        setupMediaSession()
        setupClickListeners()
        observeState()
    }

    private fun setupPlayer() {
        val player = playerManager.initializePlayer()
        binding.playerView.player = player
        binding.playerView.useController = true

        subtitleManager = SubtitleManager(player).also { it.attach() }

        playerManager.loadHlsStream(hlsUrl, contentId, contentTitle)

        playerManager.onPlayerReady = {
            binding.debugOverlay.visibility = View.VISIBLE
            playerManager.play()
        }

        playerManager.onPlayerError = { error ->
            showToast("Playback error: $error")
        }
    }

    private fun setupMediaSession() {
        mediaSessionManager = MediaSessionManager(this, playerManager.initializePlayer())
    }

    private fun setupClickListeners() {
        binding.whatDidIMissButton.setOnClickListener {
            questionController.reset()
            binding.questionAnswer.visibility = View.GONE
            recapController.requestRecap()
        }

        binding.continueButton.setOnClickListener { recapController.dismissRecap() }
        binding.watchMissedButton.setOnClickListener { recapController.watchMissedPart() }

        binding.chipWhy.setOnClickListener { questionController.ask("Why is that important?") }
        binding.chipClues.setOnClickListener { questionController.ask("What clues do we know?") }
        binding.chipWho.setOnClickListener { questionController.ask("Who is involved?") }
        binding.chipEarlier.setOnClickListener { questionController.ask("What happened earlier?") }

        binding.recapOverlay.setOnClickListener { /* consume */ }
    }

    private fun observeState() {
        lifecycleScope.launch {
            playerManager.playbackSnapshot.collectLatest { snapshot ->
                snapshot?.let { updateDebugOverlay(it) }
            }
        }

        lifecycleScope.launch {
            recapController.recapState.collectLatest { state ->
                when (state) {
                    is RecapState.Idle -> hideRecapOverlay()
                    is RecapState.Loading -> showLoadingOverlay()
                    is RecapState.Success -> showRecapOverlay(state)
                    is RecapState.Offline -> showOfflineOverlay(state)
                }
            }
        }

        lifecycleScope.launch {
            questionController.questionState.collectLatest { state ->
                when (state) {
                    is QuestionState.Idle -> {
                        binding.questionLoading.visibility = View.GONE
                    }
                    is QuestionState.Loading -> {
                        binding.questionAnswer.visibility = View.GONE
                        binding.questionLoading.visibility = View.VISIBLE
                    }
                    is QuestionState.Success -> {
                        binding.questionLoading.visibility = View.GONE
                        binding.questionAnswer.text = state.answer
                        binding.questionAnswer.visibility = View.VISIBLE
                    }
                    is QuestionState.Error -> {
                        binding.questionLoading.visibility = View.GONE
                        binding.questionAnswer.text = state.message
                        binding.questionAnswer.visibility = View.VISIBLE
                    }
                }
            }
        }
    }

    private fun updateDebugOverlay(snapshot: PlaybackSnapshot) {
        binding.debugTitle.text = "TITLE: ${snapshot.title}"
        binding.debugPosition.text = "POSITION: ${formatTime(snapshot.positionMs)}"
        binding.debugDuration.text = "DURATION: ${formatTime(snapshot.durationMs)}"
        val sceneNum = contentIndex.sceneNumberAt(snapshot.positionMs)
        val sceneTitle = contentIndex.sceneAt(snapshot.positionMs)?.title ?: "—"
        binding.debugScene.text = "SCENE: ${if (sceneNum > 0) "$sceneNum — $sceneTitle" else "?"}"
    }

    private fun showLoadingOverlay() {
        binding.recapOverlay.visibility = View.VISIBLE
        binding.recapLoading.visibility = View.VISIBLE
        binding.recapLoadingText.visibility = View.VISIBLE
        listOf(
            binding.recapTime, binding.recapSummary, binding.recapImportant,
            binding.continueButton, binding.watchMissedButton,
            binding.questionsLabel, binding.questionChips,
            binding.questionAnswer, binding.questionLoading
        ).forEach { it.visibility = View.GONE }
    }

    private fun showRecapOverlay(state: RecapState.Success) {
        val response = state.response
        val missedRange = state.missedRange

        binding.recapOverlay.visibility = View.VISIBLE
        binding.recapLoading.visibility = View.GONE
        binding.recapLoadingText.visibility = View.GONE

        binding.recapTime.text = "You missed ${formatDuration(missedRange.endMs - missedRange.startMs)}"
        binding.recapTime.visibility = View.VISIBLE

        binding.recapSummary.text = response.summary
        binding.recapSummary.visibility = View.VISIBLE

        if (response.importantClue != null) {
            binding.recapImportant.text = "★ IMPORTANT\n${response.importantClue.text}"
            binding.recapImportant.visibility = View.VISIBLE
        } else {
            binding.recapImportant.visibility = View.GONE
        }

        binding.questionsLabel.visibility = View.VISIBLE
        binding.questionChips.visibility = View.VISIBLE
        binding.continueButton.visibility = View.VISIBLE
        binding.watchMissedButton.visibility = View.VISIBLE
        binding.continueButton.requestFocus()
    }

    private fun showOfflineOverlay(state: RecapState.Offline) {
        binding.recapOverlay.visibility = View.VISIBLE
        binding.recapLoading.visibility = View.GONE
        binding.recapLoadingText.visibility = View.GONE

        binding.recapTime.text = "You missed ${formatDuration(state.missedRange.endMs - state.missedRange.startMs)} (offline summary)"
        binding.recapTime.visibility = View.VISIBLE

        binding.recapSummary.text = state.summary
        binding.recapSummary.visibility = View.VISIBLE
        binding.recapImportant.visibility = View.GONE

        // Questions need the backend — hide chips in offline mode
        binding.questionsLabel.visibility = View.GONE
        binding.questionChips.visibility = View.GONE
        binding.continueButton.visibility = View.VISIBLE
        binding.watchMissedButton.visibility = View.VISIBLE
        binding.continueButton.requestFocus()
    }

    private fun hideRecapOverlay() {
        binding.recapOverlay.visibility = View.GONE
        binding.whatDidIMissButton.requestFocus()
    }

    private fun formatTime(ms: Long): String {
        val hours = TimeUnit.MILLISECONDS.toHours(ms)
        val minutes = TimeUnit.MILLISECONDS.toMinutes(ms) % 60
        val seconds = TimeUnit.MILLISECONDS.toSeconds(ms) % 60
        return if (hours > 0) String.format("%d:%02d:%02d", hours, minutes, seconds)
        else String.format("%02d:%02d", minutes, seconds)
    }

    private fun formatDuration(ms: Long): String {
        val minutes = ms / 60000
        val seconds = (ms % 60000) / 1000
        return if (minutes > 0) "${minutes} min ${seconds} sec" else "${seconds} sec"
    }

    private fun showToast(msg: String) {
        binding.recapSummary.text = msg
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_BACK -> {
                if (binding.recapOverlay.visibility == View.VISIBLE) {
                    recapController.dismissRecap()
                    return true
                }
            }
            KeyEvent.KEYCODE_MENU -> {
                binding.debugOverlay.visibility =
                    if (binding.debugOverlay.visibility == View.VISIBLE) View.GONE else View.VISIBLE
                return true
            }
            // Quick trigger: 'M' / Info key during development
            KeyEvent.KEYCODE_M, KeyEvent.KEYCODE_INFO -> {
                if (binding.recapOverlay.visibility != View.VISIBLE) {
                    binding.whatDidIMissButton.performClick()
                    return true
                }
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onPause() {
        super.onPause()
        // Keep position updates but release decoder via PlayerView pause path
        binding.playerView.onPause()
    }

    override fun onResume() {
        super.onResume()
        binding.playerView.onResume()
    }

    override fun onDestroy() {
        super.onDestroy()
        subtitleManager?.detach()
        mediaSessionManager?.release()
        playerManager.release()
    }
}
