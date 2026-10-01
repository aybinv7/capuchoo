package com.ayb.capuchoo.device;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

/**
 * PackageInstaller's answer for a session. A confirmation request is shown to the person; every
 * outcome is forwarded to the plugin as an `installStatus` event, with the package it was about.
 */
public class InstallResultReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String packageName = intent.getStringExtra(PackageInstaller.EXTRA_PACKAGE_NAME);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);

        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = confirmation(intent);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(confirm);
                CapuchooDevicePlugin.emitInstall(packageName, "pending_user", null);
                return;
            }
            CapuchooDevicePlugin.emitInstall(packageName, "failure", "Android asked for a confirmation it did not provide");
            return;
        }

        switch (status) {
            case PackageInstaller.STATUS_SUCCESS:
                CapuchooDevicePlugin.emitInstall(packageName, "success", null);
                break;
            case PackageInstaller.STATUS_FAILURE_ABORTED:
                CapuchooDevicePlugin.emitInstall(packageName, "aborted", message);
                break;
            case PackageInstaller.STATUS_FAILURE_CONFLICT:
                CapuchooDevicePlugin.emitInstall(packageName, "conflict", describe(status, message));
                break;
            default:
                CapuchooDevicePlugin.emitInstall(packageName, "failure", describe(status, message));
        }
    }

    @SuppressWarnings("deprecation")
    private static Intent confirmation(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) return intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
        return intent.getParcelableExtra(Intent.EXTRA_INTENT);
    }

    private static String describe(int status, String detail) {
        String reason;
        switch (status) {
            case PackageInstaller.STATUS_FAILURE_CONFLICT:
                reason = "it conflicts with the installed app, usually a different signing key or an older build";
                break;
            case PackageInstaller.STATUS_FAILURE_INCOMPATIBLE:
                reason = "this phone cannot run it";
                break;
            case PackageInstaller.STATUS_FAILURE_STORAGE:
                reason = "there is not enough storage";
                break;
            case PackageInstaller.STATUS_FAILURE_INVALID:
                reason = "the APK is invalid";
                break;
            case PackageInstaller.STATUS_FAILURE_BLOCKED:
                reason = "the phone blocked it";
                break;
            default:
                reason = "Android refused it";
        }
        return "Not installed: " + reason + (detail != null ? " (" + detail + ")" : "");
    }
}
