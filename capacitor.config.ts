import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId:   "com.jmf.familyoffice",
  appName: "JMF Family Office",
  webDir:  "build",

  server: {
    // Use HTTPS scheme on Android so cookies/storage behave like a real origin.
    androidScheme: "https",
  },

  plugins: {
    SplashScreen: {
      launchShowDuration:      2000,
      launchAutoHide:          true,
      backgroundColor:         "#0B1829",
      androidSplashResourceName: "splash",
      androidScaleType:        "CENTER_CROP",
      showSpinner:             false,
      splashFullScreen:        true,
      splashImmersive:         true,
    },
    StatusBar: {
      style:           "Dark",
      backgroundColor: "#0B1829",
    },
  },
};

export default config;
