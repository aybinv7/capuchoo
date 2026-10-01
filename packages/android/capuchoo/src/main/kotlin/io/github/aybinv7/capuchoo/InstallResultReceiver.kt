package io.github.aybinv7.capuchoo

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/**
 * The installer's answer. Success replaces and restarts the app, so nothing is reported for it;
 * a confirmation request is shown to the user, and anything else is a failure the UI must see.
 */
internal class InstallResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirm = intent.confirmationIntent() ?: return Capuchoo.onInstallFailed(
                    "Android asked for a confirmation it did not provide",
                )
                context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            PackageInstaller.STATUS_SUCCESS -> Unit
            PackageInstaller.STATUS_FAILURE_ABORTED -> Capuchoo.onInstallFailed("The update was cancelled")
            else -> Capuchoo.onInstallFailed(describe(status, intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)))
        }
    }

    private fun Intent.confirmationIntent(): Intent? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        else
            @Suppress("DEPRECATION")
            getParcelableExtra(Intent.EXTRA_INTENT)

    private fun describe(status: Int, detail: String?): String {
        val reason = when (status) {
            PackageInstaller.STATUS_FAILURE_CONFLICT ->
                "it conflicts with the installed app, usually a different signing key"
            PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> "this device cannot run it"
            PackageInstaller.STATUS_FAILURE_STORAGE -> "there is not enough storage"
            PackageInstaller.STATUS_FAILURE_INVALID -> "the APK is invalid"
            PackageInstaller.STATUS_FAILURE_BLOCKED -> "the device blocked it"
            else -> "Android refused it"
        }
        return "The update could not be installed: $reason${detail?.let { " ($it)" }.orEmpty()}"
    }
}
