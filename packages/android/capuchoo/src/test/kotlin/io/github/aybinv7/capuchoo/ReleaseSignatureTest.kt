package io.github.aybinv7.capuchoo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The vector was signed by `signRelease` in @capuchoo/core, with a key pair made for this test. */
class ReleaseSignatureTest {
    private val publicKey =
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHeRJzBLQQHG7AIAeOmv5jqNyCTi1ZQMzmlNaIv0prXyfET+bbBbpcfVOL5YExo+9sNrRrvppKQoNNs8NJXuY9Q=="
    private val sha256 = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    private val release = NativeRelease(
        versionName = "1.4.0",
        versionCode = 42,
        downloadUrl = "https://updates.example.com/a.apk",
        required = false,
        releaseNotes = null,
        fileSize = null,
        checksum = sha256,
        signature = "VyWHruAvGnMwtb7Bqe0DuqgpvODW0bCiF96I6NXViIWR1ICBgZYiMltyz4X4YqngAFVbp39WcreV2MV0QqmVNg",
        appId = "com.example.field",
    )

    @Test
    fun `signs the same bytes as the CLI`() {
        assertEquals(
            "capuchoo-release-v1\nnative\ncom.example.field\nandroid\n1.4.0\n42\n$sha256",
            ReleaseSignature.payload(release, sha256),
        )
    }

    @Test
    fun `verifies a signature made by @capuchoo-core`() {
        assertTrue(ReleaseSignature.verify(release, sha256, publicKey))
        assertTrue(ReleaseSignature.verify(release, sha256, "-----BEGIN PUBLIC KEY-----\n$publicKey\n-----END PUBLIC KEY-----"))
    }

    @Test
    fun `refuses any change to the claim, a missing signature and garbage`() {
        assertFalse(ReleaseSignature.verify(release.copy(versionCode = 43), sha256, publicKey))
        assertFalse(ReleaseSignature.verify(release.copy(appId = "com.example.other"), sha256, publicKey))
        assertFalse(ReleaseSignature.verify(release, sha256.replace('9', '8'), publicKey))
        assertFalse(ReleaseSignature.verify(release.copy(signature = null), sha256, publicKey))
        assertFalse(ReleaseSignature.verify(release.copy(signature = "bm9wZQ"), sha256, publicKey))
        assertFalse(ReleaseSignature.verify(release, sha256, "not a key"))
    }

    @Test
    fun `encodes a high r and s as positive DER integers`() {
        val der = ReleaseSignature.p1363ToDer(ByteArray(64) { 0xff.toByte() })
        assertEquals(0x30, der[0].toInt())
        assertEquals(33, der[3].toInt())
        assertEquals(0, der[4].toInt())
    }
}
