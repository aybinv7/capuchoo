package dev.capuchoo.appsmanager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CapuchooAppsManager")
public class CapuchooAppsManagerPlugin extends Plugin {

    private CapuchooAppsManager implementation = new CapuchooAppsManager();

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        String bundleId = call.getString("bundleId");
        if (bundleId == null) {
            call.reject("Must provide a bundleId");
            return;
        }

        JSObject ret = implementation.getAppInfo(getContext(), bundleId);
        call.resolve(ret);
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String bundleId = call.getString("bundleId");
        if (bundleId == null) {
            call.reject("Must provide a bundleId");
            return;
        }

        boolean success = implementation.openApp(getContext(), bundleId);
        if (success) {
            JSObject ret = new JSObject();
            ret.put("completed", true);
            call.resolve(ret);
        } else {
            call.reject("App not found or cannot be launched");
        }
    }

    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        JSArray apps = implementation.getInstalledApps(getContext());
        JSObject ret = new JSObject();
        ret.put("apps", apps);
        call.resolve(ret);
    }
}
