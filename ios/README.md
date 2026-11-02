# SnapCravings iOS (Capacitor wrapper)

Wraps https://snapcravings.pages.dev in a native iOS shell. Bundle id: `app.snapcravings.ios`.

- `capacitor.config.json` - remote URL, `www/offline.html` shown when the site can't load.
- Camera / photo usage strings, splash and app icon are in `ios/App/App` (Info.plist, Assets.xcassets).
- Icons/splash regenerate with `npx capacitor-assets generate --ios` from `assets/`.

## Build
`.github/workflows/ios.yml` (manual `workflow_dispatch` only, macos-latest) builds an **unsigned simulator** app and uploads it as an artifact.
Locally on a Mac: `cd ios && npm ci && npx cap sync ios && npx cap open ios`.

## Signing + App Store Connect upload (TODO after Apple Developer enrollment)
Add these repo secrets (Settings > Secrets and variables > Actions), then add an archive/export/upload job:

| Secret | What |
|---|---|
| `APPLE_TEAM_ID` | 10-char Team ID from developer.apple.com > Membership |
| `IOS_DIST_CERT_P12_BASE64` | Apple Distribution certificate exported as .p12, base64 |
| `IOS_DIST_CERT_PASSWORD` | password of that .p12 |
| `IOS_PROVISIONING_PROFILE_BASE64` | App Store provisioning profile for `app.snapcravings.ios`, base64 |
| `ASC_KEY_ID` | App Store Connect API key ID |
| `ASC_ISSUER_ID` | App Store Connect API issuer ID |
| `ASC_PRIVATE_KEY` | contents of the AuthKey_XXXX.p8 (App Manager role) |

Also needed: register the bundle id `app.snapcravings.ios` and create the app record in App Store Connect.
Never commit .p12, .p8 or .mobileprovision files (gitignored).
