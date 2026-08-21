// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapuchooAppsManager",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapuchooAppsManager",
            targets: ["CapuchooAppsManagerPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "CapuchooAppsManagerPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/CapuchooAppsManagerPlugin"),
        .testTarget(
            name: "CapuchooAppsManagerPluginTests",
            dependencies: ["CapuchooAppsManagerPlugin"],
            path: "ios/Tests/CapuchooAppsManagerPluginTests")
    ]
)