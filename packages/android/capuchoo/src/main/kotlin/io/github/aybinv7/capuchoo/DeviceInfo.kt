package io.github.aybinv7.capuchoo

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import java.util.UUID

/** Reads what the running build is, from the package manager rather than from configuration. */
internal class DeviceInfo(private val context: Context) {

    fun facts(): DeviceFacts {
        val info = installedPackage(context)
        return DeviceFacts(
            appId = context.packageName,
            versionCode = info.longVersionCodeCompat,
            versionName = info.versionName.orEmpty(),
            deviceId = deviceId(),
            isProd = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE == 0,
            isEmulator = isEmulator(),
            osVersion = Build.VERSION.RELEASE,
            manufacturer = Build.MANUFACTURER,
            model = Build.MODEL,
            deviceName = deviceName(),
        )
    }

    /** One id per install, kept across launches; never a hardware identifier. */
    private fun deviceId(): String {
        val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        preferences.getString(DEVICE_ID, null)?.let { return it }
        val id = UUID.randomUUID().toString()
        preferences.edit().putString(DEVICE_ID, id).apply()
        return id
    }

    private fun deviceName(): String? =
        Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME)?.takeIf { it.isNotBlank() }

    private fun isEmulator(): Boolean =
        Build.FINGERPRINT.startsWith("generic") ||
            Build.FINGERPRINT.contains("emulator") ||
            Build.HARDWARE in setOf("goldfish", "ranchu") ||
            Build.MODEL.contains("Emulator") ||
            Build.MODEL.contains("Android SDK built for") ||
            Build.PRODUCT.contains("sdk_gphone")

    internal companion object {
        const val PREFERENCES = "capuchoo"
        private const val DEVICE_ID = "device_id"

        fun installedPackage(context: Context): PackageInfo =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                context.packageManager.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
            else
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(context.packageName, 0)
    }
}

internal val PackageInfo.longVersionCodeCompat: Long
    get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) longVersionCode else @Suppress("DEPRECATION") versionCode.toLong()
