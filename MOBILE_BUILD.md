# JMF Family Office — Mobile Build Guide

## Overview

The app is wrapped with [Capacitor 8](https://capacitorjs.com/) which takes the React
production build and packages it as a native iOS / Android app.
The Supabase backend, auth, and all dashboard data are unchanged — the same Supabase
project serves both the Vercel web app and the native apps.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18 + | `node -v` |
| Xcode | 15 + | Mac only, from App Store |
| CocoaPods | latest | `sudo gem install cocoapods` |
| Android Studio | latest | + Android SDK 34 |
| JDK | 17 | bundled with Android Studio |

---

## One-time setup (already done in this repo)

These steps have already been run — no need to repeat:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android \
            @capacitor/status-bar @capacitor/splash-screen
npx cap add ios
npx cap add android
```

---

## Daily workflow

### 1 — Make React changes

```bash
# Edit src/ files normally
npm start   # develop in browser as usual
```

### 2 — Build and sync to native projects

```bash
npm run cap:build   # = npm run build && npx cap sync
```

This copies `build/` into both `ios/App/App/public/` and
`android/app/src/main/assets/public/`.

### 3 — Open in Xcode or Android Studio

```bash
npm run cap:ios        # sync + open Xcode
npm run cap:android    # sync + open Android Studio
```

Then archive / build from the IDE.

---

## App icon & splash screen

### Replace placeholder assets

1. Create your final artwork:
   - `resources/icon.png` — **1024 × 1024 px**, no transparency, no rounded corners
     (the OS applies the mask). Use the JMF gold mark on navy background.
   - `resources/splash.png` — **2732 × 2732 px**, centered artwork, safe zone in the
     middle 1200 × 1200 px (the rest may be cropped on smaller devices).

2. Regenerate all sizes:

```bash
npm run cap:icons
```

This runs `@capacitor/assets generate` and writes all required sizes to:
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- `ios/App/App/Assets.xcassets/Splash.imageset/`
- `android/app/src/main/res/mipmap-*/`
- `android/app/src/main/res/drawable-*/`

3. Run `npx cap sync` (or `npm run cap:build`) to pick up the new assets.

---

## iOS — App Store submission

### First time

1. In Xcode, open `ios/App/App.xcworkspace` (not `.xcodeproj`).
2. **Signing & Capabilities** → select your Apple Developer team.
3. **Bundle Identifier**: already set to `com.jmf.familyoffice`.
4. Set **Version** and **Build** numbers.
5. Product → Archive → Distribute App → App Store Connect.

### Info.plist entries (already set by Capacitor)

| Key | Value |
|---|---|
| `NSAppTransportSecurity` | HTTPS enforced (Supabase is HTTPS) |
| `UIViewControllerBasedStatusBarAppearance` | NO |
| `UIStatusBarStyle` | UIStatusBarStyleLightContent |

### Privacy — no special entitlements needed

The app uses only:
- Network access (Supabase HTTPS calls) — no plist key required
- Local storage (Supabase session in WKWebView localStorage)

No camera, location, contacts, or push notifications.

### App Store review notes (for private family distribution)

Apple allows private apps distributed via **TestFlight** (up to 10,000 testers) or
**Apple Business Manager** (private B2B). For a 6-person family:

- **Recommended**: TestFlight internal testing (no review required) — invite each family
  member by Apple ID email. Instant, free.
- **Alternative**: Custom App via Apple Business Manager (requires Apple Developer
  Enterprise Program or B2B app setup).

If submitting to the public App Store: the login screen must work without the reviewer
having a real account. Provide a demo login in App Store Connect → App Information →
Notes to Reviewer.

---

## Android — Google Play submission

### First time

1. Open `android/` in Android Studio.
2. Build → Generate Signed Bundle / APK → Android App Bundle (.aab).
3. Create a new keystore (keep it safe — you cannot change it later):
   ```
   keytool -genkey -v -keystore jmf-release.keystore -alias jmf \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
4. In `android/app/build.gradle`, add the signing config (do NOT commit the keystore).
5. Upload the `.aab` to Google Play Console → Internal Testing track.

### For private family distribution

Google Play **Internal Testing** track supports up to 100 testers by email — invite
each family member. No store listing review needed.

Alternatively, distribute the signed `.apk` directly (sideload):
- Enable "Install from unknown sources" on each device
- Share the `.apk` via AirDrop / Google Drive
- No Play Store needed

### Package name

`com.jmf.familyoffice` (set in `capacitor.config.ts` and `android/app/build.gradle`)

---

## Auth & session persistence

Supabase JS v2 stores the session in `localStorage`, which is available in both
WKWebView (iOS) and the Capacitor Android WebView. Sessions survive app restarts.

The app uses email + password login (`signInWithPassword`). No OAuth redirects or
deep links are required.

**No anonymous access** — the Supabase RLS policies require `auth.uid()` on all tables.
The login screen is shown immediately if no session exists.

---

## Environment / secrets

The Supabase URL and anon key are currently hardcoded in `src/App.js`.

For production builds, consider moving them to `.env.production`:

```
REACT_APP_SUPABASE_URL=https://bxxnjmottokudtjgigss.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
```

Then in `src/App.js`:
```js
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);
```

The anon key is safe to embed in a client app (it's public by design), but using env
vars keeps it out of git history and makes key rotation easier.

---

## Quick reference

| Command | What it does |
|---|---|
| `npm run build` | React production build |
| `npm run cap:build` | build + sync to both native projects |
| `npm run cap:ios` | build + sync + open Xcode |
| `npm run cap:android` | build + sync + open Android Studio |
| `npm run cap:icons` | regenerate all icon/splash sizes from resources/ |
| `npx cap sync` | sync only (no rebuild) |
| `npx cap copy` | copy web assets only (faster than sync) |
