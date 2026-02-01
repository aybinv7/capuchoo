import Foundation
import Capacitor

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(capuchoappsmanagerPlugin)
public class capuchoappsmanagerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "capuchoappsmanagerPlugin"
    public let jsName = "capuchoappsmanager"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = capuchoappsmanager()

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": implementation.echo(value)
        ])
    }
}
