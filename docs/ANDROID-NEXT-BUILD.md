# Next Android (TWA) build: what changed and what to rebuild

Prepared 2026-11-02. Nothing was built or uploaded to Play.

The `android/` folder is git-ignored; `android/twa-manifest.json` was edited in place.

| Change | Where | Needs a new build? |
| --- | --- | --- |
| 4 app shortcuts (Scan fridge `#scan`, Scan plate `#dish`, Crave it `#crave`, Meal prep `#prep`) with icons | `twa-manifest.json` `shortcuts` (Bubblewrap allows at most 4, so Holiday planner is web-manifest only) | **Yes** |
| Orientation `portrait` → `any` (tablets, foldables, landscape) | `twa-manifest.json` + web manifest | **Yes** |
| Monochrome icon (`icons/icon-monochrome-512.png`) | `monochromeIconUrl` (Bubblewrap uses it for the **notification** small icon) | **Yes** |
| Version 1.0.1 (2) → 1.0.2 (3) | `twa-manifest.json` | **Yes** |
| Large-screen layout, a11y fixes, contrast colors, splash colors | web (live now) | No, already live in the TWA |

## Build steps (Chris or the build worker)
1. `cd android && bubblewrap update`. It regenerates `app/` from `twa-manifest.json`; confirm the version 1.0.2 / 3 prompt.
2. **Themed launcher icon (Android 13+):** Bubblewrap does not add a `<monochrome>` layer.
   - After `update`, copy `web/icons/icon-monochrome-512.png` to `app/src/main/res/mipmap-xxxhdpi/ic_monochrome.png` (or a vector).
   - Add `<monochrome android:drawable="@mipmap/ic_monochrome" />` inside `<adaptive-icon>` in `app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`.
3. `bubblewrap build`. Upload the AAB to the internal track first and test:
   - long-press the icon to see the 4 shortcuts, and that each opens the right screen;
   - rotate a tablet or foldable;
   - themed icons on.
4. Splash: Bubblewrap's splash uses `backgroundColor` `#FBF6EF` + the launcher icon + `splashScreenFadeOutDuration` 300 ms (already configured). Android 12+ uses the system splash with the adaptive icon. No change needed.
5. `enableSiteSettingsShortcut` is on, so the launcher may show "Site settings" as a 5th shortcut. Set it to `false` if the 4 app shortcuts should be the only ones.
