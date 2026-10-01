package io.github.aybinv7.capuchoo

import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

/**
 * How this app reaches its Capuchoo server.
 *
 * @property endpoint Server base URL, e.g. `https://updates.example.com`.
 * @property channel Channel to ask; the server falls back to the app's default when null.
 * @property publicKey Base64 SPKI release key from `capuchoo keys show`. When set, an APK without
 *   a valid signature from this key is never installed.
 * @property environment `dev`, `staging` or `prod`; reported with every update event.
 * @property checkOnForeground Ask for an update each time the app comes to the foreground.
 * @property minCheckInterval Shortest time between two foreground checks.
 * @property timeout Connect and read timeout of each request.
 * @property customId A label for this install, shown in the dashboard.
 */
public data class CapuchooConfig(
    val endpoint: String,
    val channel: String? = null,
    val publicKey: String? = null,
    val environment: String? = null,
    val checkOnForeground: Boolean = true,
    val minCheckInterval: Duration = 15.minutes,
    val timeout: Duration = 15.seconds,
    val customId: String? = null,
) {
    internal val baseUrl: String get() = endpoint.trim().trimEnd('/')

    /** Why this configuration cannot work, as messages a developer can act on. */
    public fun problems(): List<String> = buildList {
        val url = baseUrl
        if (url.isEmpty()) add("endpoint is empty, so no update can ever be found")
        else if (!url.startsWith("https://") && !url.startsWith("http://"))
            add("endpoint must start with https:// (http:// only for a local server): $url")
        if (channel != null && channel.isBlank()) add("channel is blank; pass null to use the default")
        if (environment != null && environment !in ENVIRONMENTS)
            add("environment must be one of ${ENVIRONMENTS.joinToString()}, not $environment")
        if (!timeout.isPositive()) add("timeout must be positive")
    }

    private companion object {
        val ENVIRONMENTS = setOf("dev", "staging", "prod")
    }
}
