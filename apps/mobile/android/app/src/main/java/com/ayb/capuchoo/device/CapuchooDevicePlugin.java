package com.ayb.capuchoo.device;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.lang.ref.WeakReference;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;

/**
 * `CapuchooDevice`: what a WebView cannot do for a tester's phone - read other apps' packages,
 * download and hash an APK, install or uninstall it, and hold authenticated event streams. The
 * contract is `src/shared/native/device.ts`.
 */
@CapacitorPlugin(name = "CapuchooDevice")
public class CapuchooDevicePlugin extends Plugin {
    private static WeakReference<CapuchooDevicePlugin> current = new WeakReference<>(null);
    private static volatile String pendingPackage = null;

    private final ExecutorService work = Executors.newFixedThreadPool(3);
    private ApkDownloads downloads;
    private EventStreams streams;

    @Override
    public void load() {
        current = new WeakReference<>(this);
        downloads = new ApkDownloads(getContext());
        streams = new EventStreams(new EventStreams.Listener() {
            @Override
            public void message(String key, String event, String data) {
                JSObject payload = new JSObject();
                payload.put("key", key);
                payload.put("event", event);
                payload.put("data", data);
                notifyListeners("streamMessage", payload);
            }

            @Override
            public void state(String key, String state, String message) {
                JSObject payload = new JSObject();
                payload.put("key", key);
                payload.put("state", state);
                if (message != null) payload.put("message", message);
                notifyListeners("streamState", payload);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (streams != null) streams.closeAll();
        work.shutdownNow();
    }

    static void emitInstall(String packageName, String status, String message) {
        CapuchooDevicePlugin plugin = current.get();
        if (plugin == null) return;
        JSObject payload = new JSObject();
        payload.put("packageName", packageName != null ? packageName : pendingPackage);
        payload.put("status", status);
        if (message != null) payload.put("message", message);
        plugin.notifyListeners("installStatus", payload);
    }

    @PluginMethod
    public void packages(PluginCall call) {
        JSArray names = call.getArray("packageNames", new JSArray());
        JSONArray out = new JSONArray();
        try {
            for (int index = 0; index < names.length(); index++) {
                out.put(PackageQueries.describe(getContext().getPackageManager(), names.getString(index)));
            }
            JSObject result = new JSObject();
            result.put("packages", out);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void open(PluginCall call) {
        String packageName = call.getString("packageName");
        JSObject result = new JSObject();
        result.put("opened", packageName != null && PackageQueries.open(getContext(), packageName));
        call.resolve(result);
    }

    @PluginMethod
    public void download(PluginCall call) {
        String key = call.getString("key");
        String url = call.getString("url");
        if (key == null || url == null) {
            call.reject("download needs a key and a url");
            return;
        }
        String expected = call.getString("expectedSha256");
        work.execute(() -> {
            try {
                call.resolve(downloads.download(key, url, expected, (k, bytes, total) -> {
                    JSObject progress = new JSObject();
                    progress.put("key", k);
                    progress.put("bytes", bytes);
                    progress.put("total", total);
                    notifyListeners("downloadProgress", progress);
                }));
            } catch (Exception error) {
                call.reject(error.getMessage(), error);
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String key = call.getString("key");
        if (key != null) downloads.cancel(key);
        call.resolve();
    }

    @PluginMethod
    public void clearDownloads(PluginCall call) {
        downloads.clear();
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("install needs a path");
            return;
        }
        File apk = new File(path);
        if (!apk.exists()) {
            call.reject("The downloaded file is gone; download it again");
            return;
        }
        work.execute(() -> {
            try {
                android.content.pm.PackageInfo archive = PackageQueries.archive(getContext().getPackageManager(), apk);
                pendingPackage = archive != null ? archive.packageName : null;
                ApkInstaller.install(getContext(), apk);
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not hand the file to Android: " + error.getMessage(), error);
            }
        });
    }

    @PluginMethod
    public void uninstall(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null) {
            call.reject("uninstall needs a packageName");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + packageName));
        startActivityForResult(call, intent, "uninstallClosed");
    }

    @ActivityCallback
    private void uninstallClosed(PluginCall call, ActivityResult ignored) {
        String packageName = call.getString("packageName");
        JSObject result = new JSObject();
        result.put("uninstalled", PackageQueries.installed(getContext().getPackageManager(), packageName) == null);
        call.resolve(result);
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openStream(PluginCall call) {
        String key = call.getString("key");
        String url = call.getString("url");
        String token = call.getString("token");
        if (key == null || url == null || token == null) {
            call.reject("openStream needs a key, a url and a token");
            return;
        }
        streams.open(key, url, token);
        call.resolve();
    }

    @PluginMethod
    public void closeStream(PluginCall call) {
        String key = call.getString("key");
        if (key != null) streams.close(key);
        call.resolve();
    }
}
