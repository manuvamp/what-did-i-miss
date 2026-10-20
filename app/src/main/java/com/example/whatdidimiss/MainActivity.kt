package com.example.whatdidimiss

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.whatdidimiss.databinding.ActivityMainBinding
import com.example.whatdidimiss.networking.ApiClient
import com.example.whatdidimiss.networking.Highlight
import com.example.whatdidimiss.player.ContentIndex
import com.example.whatdidimiss.player.MediaSessionManager
import com.example.whatdidimiss.player.PlaybackSnapshot
import com.example.whatdidimiss.player.PlayerManager
import com.example.whatdidimiss.player.SubtitleManager
import com.example.whatdidimiss.questions.QuestionController
import com.example.whatdidimiss.questions.QuestionState
import com.example.whatdidimiss.recap.RecapController
import com.example.whatdidimiss.recap.RecapState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.net.URL
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private companion object {
        const val SLIDE_MS = 3500L
        const val FADE_MS = 350L
    }

    private lateinit var binding: ActivityMainBinding
    private lateinit var playerManager: PlayerManager
    private lateinit var recapController: RecapController
    private lateinit var questionController: QuestionController
    private lateinit var contentIndex: ContentIndex
    private var mediaSessionManager: MediaSessionManager? = null
    private var subtitleManager: SubtitleManager? = null

    private val contentId = "sintel_001"
    private val contentTitle = "Sintel"

    // Backend URL — 10.0.2.2 reaches the host from an emulator/simulator;
    // use the LAN IP of the dev machine for a physical Fire TV.
    private val backendBaseUrl = BuildConfig.BACKEND_URL

    // HLS stream — Sintel served by the backend at /hls/sintel/index.m3u8
    // (see Prompt 4). Falls back to the public bipbop test stream if unset.
    private val hlsUrl = BuildConfig.STREAM_URL

    // Visual recap montage: one coroutine plays the slides; OK/right sends "next".
    private var montageJob: Job? = null
    private val nextSlide = Channel<Unit>(Channel.CONFLATED)

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

        binding.visual2Button.setOnClickListener { requestVisualRecap(2) }
        binding.visual5Button.setOnClickListener { requestVisualRecap(5) }
        binding.visual10Button.setOnClickListener { requestVisualRecap(10) }
        binding.visualRecapOverlay.setOnClickListener { nextSlide.trySend(Unit) }

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
                    is RecapState.Success ->
                        if (state.visualWindowMs != null && !state.response.highlights.isNullOrEmpty()) {
                            playVisualRecap(state)
                        } else {
                            showRecapOverlay(state)
                        }
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
        binding.whatDidIMissButton.visibility = View.GONE
        binding.recapOverlay.visibility = View.VISIBLE
        binding.recapLoading.visibility = View.VISIBLE
        binding.recapLoadingText.visibility = View.VISIBLE
        listOf(
            binding.recapTime, binding.recapSummary, binding.recapImportant,
            binding.visualLabel, binding.visualButtons,
            binding.continueButton, binding.watchMissedButton,
            binding.questionsLabel, binding.questionChips,
            binding.questionAnswer, binding.questionLoading
        ).forEach { it.visibility = View.GONE }
    }

    private fun showRecapOverlay(state: RecapState.Success) {
        val response = state.response
        val missedRange = state.missedRange

        binding.whatDidIMissButton.visibility = View.GONE
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

        binding.visualLabel.visibility = View.VISIBLE
        binding.visualButtons.visibility = View.VISIBLE
        binding.questionsLabel.visibility = View.VISIBLE
        binding.questionChips.visibility = View.VISIBLE
        binding.continueButton.visibility = View.VISIBLE
        binding.watchMissedButton.visibility = View.VISIBLE
        binding.continueButton.requestFocus()
    }

    private fun showOfflineOverlay(state: RecapState.Offline) {
        binding.whatDidIMissButton.visibility = View.GONE
        binding.recapOverlay.visibility = View.VISIBLE
        binding.recapLoading.visibility = View.GONE
        binding.recapLoadingText.visibility = View.GONE

        binding.recapTime.text = "You missed ${formatDuration(state.missedRange.endMs - state.missedRange.startMs)} (offline summary)"
        binding.recapTime.visibility = View.VISIBLE

        binding.recapSummary.text = state.summary
        binding.recapSummary.visibility = View.VISIBLE
        binding.recapImportant.visibility = View.GONE

        // Questions and the visual recap need the backend — hide them in offline mode
        binding.visualLabel.visibility = View.GONE
        binding.visualButtons.visibility = View.GONE
        binding.questionsLabel.visibility = View.GONE
        binding.questionChips.visibility = View.GONE
        binding.continueButton.visibility = View.VISIBLE
        binding.watchMissedButton.visibility = View.VISIBLE
        binding.continueButton.requestFocus()
    }

    private fun requestVisualRecap(minutes: Long) {
        questionController.reset()
        binding.questionAnswer.visibility = View.GONE
        recapController.requestRecap(visualWindowMs = TimeUnit.MINUTES.toMillis(minutes))
    }

    /**
     * Plays the key moments of the chosen window as a quick montage: each
     * real frame with a slow push-in and a subtitle-style caption, then lands
     * on that window's text recap.
     */
    private fun playVisualRecap(state: RecapState.Success) {
        val highlights = state.response.highlights.orEmpty()
        val minutes = TimeUnit.MILLISECONDS.toMinutes(state.visualWindowMs ?: 0)
        montageJob?.cancel()
        while (nextSlide.tryReceive().isSuccess) Unit // drop presses from before the montage

        montageJob = lifecycleScope.launch {
            binding.recapOverlay.visibility = View.GONE
            binding.visualRecapOverlay.visibility = View.VISIBLE
            binding.visualRecapOverlay.requestFocus()
            binding.visualImage.setImageDrawable(null)
            binding.visualHeader.text = "LAST $minutes MIN"
            binding.visualScene.text = ""
            binding.visualCaption.text = getString(R.string.analyzing)
            val fills = buildProgressSegments(highlights.size)

            val frames = withContext(Dispatchers.IO) { highlights.map { loadFrame(it) } }

            highlights.forEachIndexed { i, highlight ->
                binding.visualHeader.text = "LAST $minutes MIN  ·  ${i + 1} / ${highlights.size}"
                binding.visualScene.text = "${formatTime(highlight.timestampMs)}  ·  ${highlight.sceneTitle}"
                binding.visualCaption.text = highlight.caption
                binding.visualImage.setImageBitmap(frames[i])
                binding.visualImage.apply {
                    animate().cancel()
                    alpha = 0f; scaleX = 1f; scaleY = 1f
                    animate().alpha(1f).setDuration(FADE_MS).start()
                    // Slow push-in, on its own animator so it outlasts the fade
                    ObjectAnimator.ofPropertyValuesHolder(
                        this,
                        PropertyValuesHolder.ofFloat(View.SCALE_X, 1f, 1.08f),
                        PropertyValuesHolder.ofFloat(View.SCALE_Y, 1f, 1.08f)
                    ).setDuration(SLIDE_MS).start()
                }
                fills[i].apply {
                    pivotX = 0f; scaleX = 0f
                    animate().scaleX(1f).setDuration(SLIDE_MS).start()
                }
                withTimeoutOrNull(SLIDE_MS) { nextSlide.receive() }
                fills[i].animate().cancel()
                fills[i].scaleX = 1f
            }
            finishVisualRecap(state)
        }
    }

    private fun finishVisualRecap(state: RecapState.Success) {
        montageJob?.cancel()
        montageJob = null
        binding.visualImage.animate().cancel()
        binding.visualRecapOverlay.visibility = View.GONE
        showRecapOverlay(state)
    }

    /** One thin bar per slide; returns the accent fill views to animate. */
    private fun buildProgressSegments(count: Int): List<View> {
        val bar = binding.visualProgress
        bar.removeAllViews()
        val gap = (4 * resources.displayMetrics.density).toInt()
        return List(count) { i ->
            val track = FrameLayout(this).apply {
                setBackgroundColor(0x40FFFFFF)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
                    .apply { if (i > 0) marginStart = gap }
            }
            val fill = View(this).apply {
                setBackgroundColor(getColor(R.color.accent))
                scaleX = 0f
            }
            track.addView(fill, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            bar.addView(track)
            fill
        }
    }

    private fun loadFrame(highlight: Highlight): Bitmap? = highlight.frameUrl?.let { path ->
        runCatching {
            URL(backendBaseUrl + path).openStream().use { BitmapFactory.decodeStream(it) }
        }.getOrNull()
    }

    private fun hideRecapOverlay() {
        binding.recapOverlay.visibility = View.GONE
        binding.whatDidIMissButton.visibility = View.VISIBLE
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

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // While the montage plays it owns the remote: OK/right = next, BACK = skip.
        if (binding.visualRecapOverlay.visibility == View.VISIBLE) {
            if (event.action == KeyEvent.ACTION_DOWN) {
                val state = recapController.recapState.value
                when (event.keyCode) {
                    KeyEvent.KEYCODE_BACK ->
                        if (state is RecapState.Success) finishVisualRecap(state)
                    KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER,
                    KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD ->
                        nextSlide.trySend(Unit)
                }
            }
            return true
        }
        return super.dispatchKeyEvent(event)
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
            // Remote FF / REW: jump 15 s (a forward jump is recorded as missed)
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD, KeyEvent.KEYCODE_MEDIA_REWIND -> {
                if (binding.recapOverlay.visibility != View.VISIBLE) {
                    val step = if (keyCode == KeyEvent.KEYCODE_MEDIA_FAST_FORWARD) 15_000L else -15_000L
                    playerManager.seekTo(maxOf(0L, playerManager.getCurrentPosition() + step))
                    return true
                }
            }
            // Number keys: visual recap of the last 2 / 5 / 10 minutes
            KeyEvent.KEYCODE_2 -> { requestVisualRecap(2); return true }
            KeyEvent.KEYCODE_5 -> { requestVisualRecap(5); return true }
            KeyEvent.KEYCODE_0 -> { requestVisualRecap(10); return true }
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
        montageJob?.cancel()
        subtitleManager?.detach()
        mediaSessionManager?.release()
        playerManager.release()
    }
}
