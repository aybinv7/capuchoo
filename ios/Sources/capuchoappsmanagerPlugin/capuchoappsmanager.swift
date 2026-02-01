import Foundation

@objc public class capuchoappsmanager: NSObject {
    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }
}
