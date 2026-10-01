package io.github.aybinv7.capuchoo

import java.math.BigInteger
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

/**
 * Release signatures as @capuchoo/core makes them: ECDSA P-256 over SHA-256 of a newline-joined
 * claim, transported as base64url IEEE P1363 (`r || s`). Java verifies DER, so the signature is
 * re-encoded before checking.
 */
internal object ReleaseSignature {
    private const val VERSION = "capuchoo-release-v1"
    private val SHA256_HEX = Regex("^[0-9a-f]{64}$")

    /** The exact bytes the CLI signed for a native release. */
    fun payload(release: NativeRelease, sha256: String): String {
        require(SHA256_HEX.matches(sha256)) { "sha256 must be 64 lowercase hex" }
        for ((field, value) in listOf("appId" to release.appId, "version" to release.versionName)) {
            require(value.isNotEmpty() && '\n' !in value) { "Release $field is empty or multi-line" }
        }
        return listOf(
            VERSION,
            "native",
            release.appId,
            "android",
            release.versionName,
            release.versionCode.toString(),
            sha256,
        ).joinToString("\n")
    }

    /** True only for a well-formed signature by [publicKey], a base64 or PEM SPKI key. */
    fun verify(release: NativeRelease, sha256: String, publicKey: String): Boolean {
        val signature = release.signature ?: return false
        return try {
            val key = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(decode(pemBody(publicKey))))
            Signature.getInstance("SHA256withECDSA").run {
                initVerify(key)
                update(payload(release, sha256).toByteArray(Charsets.UTF_8))
                verify(p1363ToDer(decode(signature)))
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun pemBody(value: String): String =
        value.replace(Regex("-----(BEGIN|END) [A-Z ]+-----"), "").replace(Regex("\\s+"), "")

    private fun decode(value: String): ByteArray {
        val normalised = value.replace('-', '+').replace('_', '/').replace(Regex("\\s+"), "")
        return Base64.getDecoder().decode(normalised + "=".repeat((4 - normalised.length % 4) % 4))
    }

    /** `r || s`, 32 bytes each for P-256, to an ASN.1 SEQUENCE of two INTEGERs. */
    fun p1363ToDer(raw: ByteArray): ByteArray {
        require(raw.size == 64) { "a P-256 signature is 64 bytes, not ${raw.size}" }
        val r = BigInteger(1, raw.copyOfRange(0, 32)).toByteArray()
        val s = BigInteger(1, raw.copyOfRange(32, 64)).toByteArray()
        val body = byteArrayOf(0x02, r.size.toByte()) + r + byteArrayOf(0x02, s.size.toByte()) + s
        return byteArrayOf(0x30, body.size.toByte()) + body
    }
}
