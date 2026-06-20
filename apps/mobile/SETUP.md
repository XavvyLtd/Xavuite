# XavvySuite Mobile — Android Setup Guide

## Prerequisites
- Node.js 18+
- Android Studio (for local dev) OR just EAS Build (cloud, no Android Studio needed)
- Expo account (free) — https://expo.dev/signup
- EAS CLI

## Step 1 — Install dependencies

```bash
cd xavvysuite-mobile
npm install
npm install -g eas-cli
```

## Step 2 — Login to Expo

```bash
eas login
# Enter your Expo account credentials
```

## Step 3 — Configure EAS project

```bash
eas init
# This creates a projectId in app.json automatically
```

## Step 4 — Update API base URL

In `src/store/auth.ts`, change the hardcoded URL:
```ts
// Line: const base = tenant?.apiBase ?? 'https://api.xavvysuite.com';
// Change to your actual worker URL:
const base = tenant?.apiBase ?? 'https://your-worker.your-account.workers.dev';
```

Also in `resolveTenant()`:
```ts
// Change:
const res = await fetch(`https://api.xavvysuite.com/api/tenant/resolve?email=...`);
// To:
const res = await fetch(`https://your-worker.your-account.workers.dev/api/tenant/resolve?email=...`);
```

## Step 5 — Add app icon and splash screen

Place these files in /assets/:
- `icon.png`          — 1024×1024 PNG, your app icon
- `splash.png`        — 1284×2778 PNG, splash screen
- `adaptive-icon.png` — 1024×1024 PNG, Android adaptive icon foreground
- `notification-icon.png` — 96×96 PNG, white icon on transparent background

Quick placeholder (generates coloured squares):
```bash
# Install ImageMagick or use any online tool
# Or just copy any PNG and rename it for now
```

## Step 6 — Build APK for testing (preview build)

```bash
eas build --platform android --profile preview
```

This runs in the cloud (~10-15 mins). You'll get a download link for the APK.
Install directly on any Android device — no Play Store needed for testing.

## Step 7 — Install on Android device

1. Download the APK from the EAS build URL
2. On your Android phone: Settings → Security → Install unknown apps → Allow
3. Open the APK file → Install
4. Open XavvySuite → enter work email → sign in

## Step 8 — Deep link QR code (optional)

Generate a deep link for your tenant so employees skip the email lookup:

```
xavvysuite://login?tenant=YOUR_TENANT_ID&server=https://YOUR_WORKER_URL&name=Your+Company+Name
```

Create a QR code from this URL (use qr-code-generator.com or similar).
Employees scan it on first launch → tenant is auto-configured.

## Step 9 — Production build for Play Store

1. Create a Google Play Console account (£20 one-off)
2. Create app in Play Console
3. Download google-play-key.json (service account) from Play Console
4. Place in project root as `google-play-key.json`
5. Run:
```bash
eas build --platform android --profile production
eas submit --platform android
```

## Development (local testing without build)

```bash
# Install Expo Go on your Android phone from Play Store
npm start
# Scan the QR code with Expo Go
```

Note: expo-secure-store and expo-notifications won't work in Expo Go.
Use a development build for full feature testing:
```bash
eas build --platform android --profile development
```

## Push Notifications Setup (optional)

For leave approval and timesheet reminder push notifications:
1. Create a Firebase project at console.firebase.google.com
2. Add an Android app with package `com.xavvysuite.app`
3. Download `google-services.json` → place in project root
4. In the worker, call `https://exp.host/--/api/v2/push/send` with the Expo push token

## File structure

```
xavvysuite-mobile/
├── app/
│   ├── _layout.tsx          # Root layout, deep link handler
│   ├── index.tsx            # Auth redirect
│   ├── auth.tsx             # Email → tenant resolve → login
│   └── tabs/
│       ├── _layout.tsx      # Bottom tab navigator
│       ├── clock.tsx        # Clock in/out with GPS
│       ├── time.tsx         # Quick timesheet entry
│       ├── leave.tsx        # Leave balances + request
│       ├── tasks.tsx        # My PMO tasks
│       ├── expense.tsx      # Quick expense + camera receipt
│       └── more.tsx         # Notifications + profile + sign out
├── src/
│   ├── store/auth.ts        # Zustand store, SecureStore tokens, apiFetch
│   └── components/ui.tsx    # Shared RN components
├── assets/                  # Icons and splash screens
├── app.json                 # Expo config
├── eas.json                 # EAS Build profiles
└── package.json
```
