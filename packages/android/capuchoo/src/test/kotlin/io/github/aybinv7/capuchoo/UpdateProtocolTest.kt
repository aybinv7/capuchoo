package io.github.aybinv7.capuchoo

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateProtocolTest {
    private val facts = DeviceFacts(
        appId = "com.example.field",
        versionCode = 12,
        versionName = "1.3.0",
        deviceId = "install-1",
        isProd = true,
        isEmulator = null,
        osVersion = "14",
        manufacturer = null,
        model = "Tab A9",
        deviceName = null,
    )
    private val config = CapuchooConfig(endpoint = "https://updates.example.com/", channel = "prod", environment = "prod")

    @Test
    fun `sends what @capuchoo-updater sends, and omits what it does not know`() {
        val body = buildCheckRequest(facts, config, "0.1.0")
        assertEquals("com.example.field", body.getString("appId"))
        assertEquals("android", body.getString("platform"))
        assertEquals("12", body.getString("versionCode"))
        assertEquals("12", body.getString("versionBuild"))
        assertEquals("1.3.0", body.getString("version_name"))
        assertEquals("prod", body.getString("channel"))
        assertEquals("prod", body.getString("defaultChannel"))
        assertEquals("capuchoo-android/0.1.0", body.getString("pluginVersion"))
        assertTrue(body.getBoolean("isProd"))
        assertFalse(body.has("isEmulator"))
        assertFalse(body.has("manufacturer"))
        assertEquals("Tab A9", body.getString("model"))
    }

    @Test
    fun `reads an offered native build with its integrity fields`() {
        val response = parseCheckResponse(
            JSONObject(
                """{"message":"native_update_available","kind":"blocked","app_id":"com.example.field",
                   "native_update":{"version_name":"1.4.0","version_code":13,"download_url":"https://x/a.apk",
                   "required":false,"file_size":1024,"checksum":"ABCD","signature":"sig"},
                   "config":{"maxDiscount":5,"banner":null}}""",
            ),
            "fallback",
        )
        val release = (response.check as UpdateCheck.Available).release
        assertEquals(13L, release.versionCode)
        assertEquals("abcd", release.checksum)
        assertEquals("com.example.field", release.appId)
        assertEquals(1024L, release.fileSize)
        assertFalse(release.required)
        assertEquals(5, response.config["maxDiscount"])
        assertTrue(response.config.containsKey("banner"))
    }

    @Test
    fun `treats the gate message as required, and falls back to the running app id`() {
        val response = parseCheckResponse(
            JSONObject(
                """{"message":"native_update_required","native_update":{"version_name":"2.0.0",
                   "version_code":20,"download_url":"https://x/b.apk"}}""",
            ),
            "com.example.field",
        )
        val release = (response.check as UpdateCheck.Available).release
        assertTrue(release.required)
        assertEquals("com.example.field", release.appId)
    }

    @Test
    fun `ignores a web bundle, and reports refusals instead of up to date`() {
        val ota = parseCheckResponse(JSONObject("""{"version":"1.0.1","url":"https://x/b.zip"}"""), "a")
        assertEquals(UpdateCheck.UpToDate, ota.check)
        val upToDate = parseCheckResponse(JSONObject("""{"kind":"up_to_date","message":"No bundle assigned"}"""), "a")
        assertEquals(UpdateCheck.UpToDate, upToDate.check)
        val blocked = parseCheckResponse(JSONObject("""{"message":"Channel not found","kind":"blocked"}"""), "a")
        assertEquals(UpdateCheck.Blocked("Channel not found"), blocked.check)
    }

    @Test
    fun `reports events in the shape the server validates`() {
        val release = NativeRelease("1.4.0", 13, "https://x/a.apk", false, null, null, "ab", null, "com.example.field")
        val payload = buildEventPayload("error", facts, config, release, "disk full")
        assertEquals("error", payload.getString("event"))
        assertEquals("com.example.field", payload.getString("app_id"))
        assertEquals(12, payload.getInt("current_version_code"))
        assertEquals(13, payload.getInt("new_version_code"))
        assertEquals("disk full", payload.getString("error"))
    }

    @Test
    fun `names every misconfiguration`() {
        assertTrue(CapuchooConfig(endpoint = "https://u.example.com").problems().isEmpty())
        assertEquals(1, CapuchooConfig(endpoint = "").problems().size)
        assertTrue(CapuchooConfig(endpoint = "updates.example.com").problems().single().contains("https://"))
        assertTrue(CapuchooConfig(endpoint = "https://u", environment = "qa").problems().single().contains("qa"))
        assertEquals("https://updates.example.com", config.baseUrl)
    }
}
