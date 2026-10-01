import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ayb.capuchoo",
  appName: "Capuchoo",
  webDir: "dist",
  plugins: {
    SplashScreen: { launchAutoHide: false },
    Keyboard: { resizeOnFullScreen: true },
  },
};

export default config;
