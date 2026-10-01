package io.github.aybinv7.capuchoo

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlin.time.Duration

/** JSON over HttpURLConnection, so the library adds no HTTP client to the app. */
internal class JsonHttp(private val timeout: Duration) {

    /** POSTs [body] and returns the JSON answer; transient failures are retried with backoff. */
    suspend fun post(url: String, body: JSONObject, attempts: Int = 3): JSONObject {
        var wait = 1_000L
        var last: CapuchooException? = null
        repeat(attempts) { attempt ->
            try {
                return withContext(Dispatchers.IO) { send(url, body) }
            } catch (error: CapuchooException) {
                if (error.reason != CapuchooException.Reason.Network || attempt == attempts - 1) throw error
                last = error
                delay(wait)
                wait *= 2
            }
        }
        throw last ?: CapuchooException(CapuchooException.Reason.Network, "No attempt was made")
    }

    private fun send(url: String, body: JSONObject): JSONObject {
        val connection = try {
            (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = timeout.inWholeMilliseconds.toInt()
                readTimeout = timeout.inWholeMilliseconds.toInt()
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
            }
        } catch (error: IOException) {
            throw CapuchooException(CapuchooException.Reason.Network, "Could not reach $url", error)
        }

        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status >= 500) throw CapuchooException(CapuchooException.Reason.Network, "$url answered $status")
            if (status !in 200..299)
                throw CapuchooException(CapuchooException.Reason.Server, "$url answered $status: ${errorOf(text)}")
            return JSONObject(text.ifEmpty { "{}" })
        } catch (error: IOException) {
            throw CapuchooException(CapuchooException.Reason.Network, "Could not reach $url: ${error.message}", error)
        } catch (error: JSONException) {
            throw CapuchooException(CapuchooException.Reason.Server, "$url did not answer with JSON", error)
        } finally {
            connection.disconnect()
        }
    }

    private fun errorOf(text: String): String = try {
        JSONObject(text).optString("error").ifEmpty { text.take(200) }
    } catch (_: JSONException) {
        text.take(200)
    }
}
