package io.github.aybinv7.capuchoo

import org.json.JSONObject

/** What this install reports about itself; fields it could not determine stay null and are omitted. */
internal data class DeviceFacts(
    val appId: String,
    val versionCode: Long,
    val versionName: String,
    val deviceId: String,
    val isProd: Boolean,
    val isEmulator: Boolean?,
    val osVersion: String?,
    val manufacturer: String?,
    val model: String?,
    val deviceName: String?,
)

/**
 * `POST /api/update`, shaped like `buildCheckRequest` in @capuchoo/updater: the server writes only
 * the keys it receives, so an unknown value is left out rather than sent as a placeholder that
 * would overwrite a better one recorded earlier.
 */
internal fun buildCheckRequest(
    facts: DeviceFacts,
    config: CapuchooConfig,
    libraryVersion: String,
): JSONObject = JSONObject().apply {
    put("appId", facts.appId)
    put("platform", "android")
    put("versionCode", facts.versionCode.toString())
    put("versionBuild", facts.versionCode.toString())
    put("version_name", facts.versionName)
    put("versionBuiltin", facts.versionName)
    put("deviceId", facts.deviceId)
    put("isProd", facts.isProd)
    put("pluginVersion", "capuchoo-android/$libraryVersion")
    config.channel?.let {
        put("channel", it)
        put("defaultChannel", it)
    }
    config.customId?.let { put("customId", it) }
    facts.isEmulator?.let { put("isEmulator", it) }
    facts.osVersion?.let { put("versionOs", it) }
    facts.manufacturer?.let { put("manufacturer", it) }
    facts.model?.let { put("model", it) }
    facts.deviceName?.let { put("deviceName", it) }
}

/** The server's refusals, by the exact `message` strings of `UpdateMessage` in @capuchoo/core. */
private val BLOCKING_MESSAGES = setOf(
    "App not found",
    "Channel not found",
    "Flavour mismatch",
    "Channel paused",
    "Channel disabled for this platform",
    "Channel does not serve emulators",
    "Channel does not serve development builds",
)

private const val NATIVE_UPDATE_REQUIRED = "native_update_required"

internal data class CheckResponse(val check: UpdateCheck, val config: Map<String, Any?>)

/**
 * Reads a check response. Only `native_update` is used: a top-level `url` is a web bundle for a
 * Capacitor app, which a native build has nothing to do with.
 */
internal fun parseCheckResponse(body: JSONObject, fallbackAppId: String): CheckResponse {
    val config = body.optJSONObject("config")?.toMap() ?: emptyMap()
    val message = body.optString("message").takeIf { it.isNotEmpty() }
    if (message != null && message in BLOCKING_MESSAGES) {
        val detail = body.optString("error").takeIf { it.isNotEmpty() && it != message }
        return CheckResponse(UpdateCheck.Blocked(listOfNotNull(message, detail).joinToString(": ")), config)
    }

    val native = body.optJSONObject("native_update")
    val url = native?.optString("download_url")?.takeIf { it.isNotEmpty() }
    if (native == null || url == null) return CheckResponse(UpdateCheck.UpToDate, config)

    val release = NativeRelease(
        versionName = native.optString("version_name"),
        versionCode = native.optLong("version_code"),
        downloadUrl = url,
        required = message == NATIVE_UPDATE_REQUIRED || native.optBoolean("required", false),
        releaseNotes = native.optString("release_notes").takeIf { it.isNotEmpty() },
        fileSize = native.optLong("file_size", -1).takeIf { it >= 0 },
        checksum = native.optString("checksum").takeIf { it.isNotEmpty() }?.lowercase(),
        signature = native.optString("signature").takeIf { it.isNotEmpty() },
        appId = body.optString("app_id").takeIf { it.isNotEmpty() } ?: fallbackAppId,
    )
    return CheckResponse(UpdateCheck.Available(release), config)
}

/** `POST /api/native-updates/log`, the `UpdateEventPayload` of @capuchoo/core. */
internal fun buildEventPayload(
    event: String,
    facts: DeviceFacts,
    config: CapuchooConfig,
    release: NativeRelease,
    error: String? = null,
): JSONObject = JSONObject().apply {
    put("event", event)
    put("platform", "android")
    put("app_id", facts.appId)
    put("device_id", facts.deviceId)
    put("current_version_code", facts.versionCode)
    put("new_version", release.versionName)
    put("new_version_code", release.versionCode)
    put("channel", config.channel ?: "")
    put("environment", config.environment ?: "")
    error?.let { put("error", it) }
}

private fun JSONObject.toMap(): Map<String, Any?> =
    keys().asSequence().associateWith { key -> opt(key).let { if (it == JSONObject.NULL) null else it } }
