package com.example.whatdidimiss.networking

import com.google.gson.annotations.SerializedName
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

data class RecapRequest(
    @SerializedName("contentId") val contentId: String,
    @SerializedName("currentPositionMs") val currentPositionMs: Long,
    @SerializedName("windowStartMs") val windowStartMs: Long,
    @SerializedName("windowEndMs") val windowEndMs: Long
)

data class RecapResponse(
    @SerializedName("window") val window: Window,
    @SerializedName("summary") val summary: String,
    @SerializedName("importantEvents") val importantEvents: List<String>,
    @SerializedName("importantClue") val importantClue: ImportantClue?,
    @SerializedName("relevantEarlierContext") val relevantEarlierContext: List<String>,
    @SerializedName("characters") val characters: List<String>,
    @SerializedName("spoilerChecked") val spoilerChecked: Boolean,
    @SerializedName("highlights") val highlights: List<Highlight>? = null
)

/** One key moment for the visual recap: a real frame plus a subtitle-style caption. */
data class Highlight(
    @SerializedName("timestampMs") val timestampMs: Long,
    @SerializedName("sceneTitle") val sceneTitle: String,
    @SerializedName("caption") val caption: String,
    @SerializedName("frameUrl") val frameUrl: String?
)

data class Window(
    @SerializedName("startMs") val startMs: Long,
    @SerializedName("endMs") val endMs: Long
)

data class ImportantClue(
    @SerializedName("text") val text: String,
    @SerializedName("confidence") val confidence: Float
)

data class QuestionRequest(
    @SerializedName("contentId") val contentId: String,
    @SerializedName("question") val question: String,
    @SerializedName("currentPositionMs") val currentPositionMs: Long
)

data class QuestionResponse(
    @SerializedName("answer") val answer: String,
    @SerializedName("spoilerChecked") val spoilerChecked: Boolean
)

interface ApiService {
    @POST("/api/recap")
    suspend fun getRecap(@Body request: RecapRequest): RecapResponse

    @POST("/api/question")
    suspend fun askQuestion(@Body request: QuestionRequest): QuestionResponse

    @GET("/api/content/{id}")
    suspend fun getContent(@Path("id") id: String): ContentMetadata
}

data class ContentMetadata(
    @SerializedName("contentId") val contentId: String,
    @SerializedName("title") val title: String,
    @SerializedName("type") val type: String,
    @SerializedName("durationMs") val durationMs: Long,
    @SerializedName("language") val language: String
)

class ApiClient(baseUrl: String = "http://10.0.2.2:3000") {
    private val retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    private val service = retrofit.create(ApiService::class.java)

    suspend fun getRecap(request: RecapRequest): RecapResponse = service.getRecap(request)
    suspend fun askQuestion(request: QuestionRequest): QuestionResponse = service.askQuestion(request)
    suspend fun getContent(id: String): ContentMetadata = service.getContent(id)
}
