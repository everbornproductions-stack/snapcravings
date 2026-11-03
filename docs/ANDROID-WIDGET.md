# Android home-screen widget for SnapCravings (research, not built)

Status, 2026-11-02: **not built.** This is a write-up of the native option.

## Can the TWA or Bubblewrap do it?
No.
- Bubblewrap (`@bubblewrap/cli` 1.27) generates a Trusted Web Activity wrapper. Its `twa-manifest.json` options cover shortcuts, notifications, Play Billing, location delegation, file and protocol handlers. None of them is a widget.
- A TWA is a Chrome tab shown full screen. Android widgets are `RemoteViews` drawn by the launcher process, so web content can't render inside one.
- The web-manifest `widgets` member (Adaptive Cards) only works in Edge on Windows 11. Chrome on Android ignores it.

## The native option
Add a small native widget module to the generated Android project. The TWA stays the app; the widget only links into it.

1. **Widget type: "quick actions" (static, no data).** Four buttons: Scan fridge, Scan plate, Crave it, Meal prep. Each fires a `PendingIntent` that opens `LauncherActivity` with the deep link (`https://snapcravings.pages.dev/?src=widget#scan`, `#dish`, `#crave`, `#prep`).
   - No network, no login, no sync.
   - About a day of work: `AppWidgetProvider` (or Jetpack Glance `GlanceAppWidget`), `res/xml/sc_widget_info.xml`, a layout, and a `<receiver>` in `AndroidManifest.xml`.
2. **Optional v2: "holiday countdown / tonight's idea".** Shows the next holiday (from `/api/trending?country=XX`, already public JSON) and one trending dish.
   - Needs `WorkManager` for refresh (minimum 30 minutes), plus caching and error states.
   - About 2–3 days.
   - Must not show anything personal (diet, favorites live in the web app's localStorage and are not reachable from native code).

## The catch: Bubblewrap regenerates the project
`bubblewrap update` / `build` re-create `app/` from templates when `twa-manifest.json` changes. That would wipe the native files.

Options:
- (a) Keep the widget in a separate Gradle module (`:widget`) and re-apply one line in `settings.gradle` and `app/build.gradle` after each update. A `scripts/android-postupdate.sh` could patch it.
- (b) Stop regenerating. Treat `android/` as a hand-maintained project and edit `twa-manifest.json`-derived values directly in `app/build.gradle`. Preferred once a widget exists.

## Play featuring note
Widgets are a plus for "Android feel", not a requirement. Shortcuts (done, next build), themed and monochrome icon, large-screen layout, and accessibility count for more. Recommend doing option 1 only after the next build ships.
