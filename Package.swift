// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapuchoAppsManager",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapuchoAppsManager",
            targets: ["capuchoappsmanagerPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "capuchoappsmanagerPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/capuchoappsmanagerPlugin"),
        .testTarget(
            name: "capuchoappsmanagerPluginTests",
            dependencies: ["capuchoappsmanagerPlugin"],
            path: "ios/Tests/capuchoappsmanagerPluginTests")
    ]
)