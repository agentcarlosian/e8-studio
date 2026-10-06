# Platform verification handoff — October 1, 2026

This branch adds package gates without publishing a binary or changing the
deployed site. The platform checks distinguish an archive that was assembled
correctly from an app that has been exercised on a real device.

## Local evidence

- Playwright WebKit booted the hosted build at 1440 × 900 and 390 × 844,
  opened the beginner lesson, and switched to Quasicrystal without page
  errors. With WebGL forced unavailable, its **Open 2D Studio** action loaded
  and rendered the Canvas2D page. This is WebKit engine coverage, not Safari
  on an iPhone, iPad, or Mac.
- The Android APK inventory verifier passed a synthetic APK and rejected a
  mismatched embedded HTML file and a leaked release manifest. The staged
  `dist/mobile/index.html` inventory check passed locally.
- The Electron ASAR inventory verifier passed a synthetic archive and rejected
  a bundled `dist/vendor` sidecar. A real local Windows package also passed:
  the NSIS installer and portable executable were built, the unpacked ASAR
  contained the exact offline HTML, and the app opened E8, switched to a 4D
  view while offline, and opened the beginner lesson without renderer errors.
  The installer was not installed or signed.

The ordinary `npm run electron:dist` extraction failed twice on this host with
`EPERM` while renaming `win-unpacked.tmp`. A one-off ignored config using
[Electron Builder's `electronDist` option](https://www.electron.build/docs/api/electron-builder.interface.configuration/#electrondist) and the already extracted pinned
runtime completed the package build. The checked-in package command was not
changed; CI will exercise that ordinary path on its Windows runner.

## CI package gates added

- `android-package` builds and syncs the clean Capacitor input, assembles an
  unsigned debug APK, and checks that `assets/public/index.html` exactly
  matches both the staged and synced HTML. It rejects unrelated public assets.
  The project pins Android Gradle Plugin 8.13; [Google's compatibility table](https://developer.android.com/build/releases/agp-8-13-0-release-notes)
  lists JDK 17 as its minimum and SDK Build Tools 35.0.0. The pinned Capacitor
  Android module targets Java 21, so CI uses JDK 21 and installs API 36,
  matching `android/variables.gradle`.
- `windows-build` now runs a WebKit engine smoke after the web build.
- `electron-package` builds the Windows Electron installer, verifies that the
  unpacked ASAR contains the exact offline HTML and no vendor sidecars, then
  boots the packaged app and checks an offline 4D view or its no-WebGL fallback.

These new CI jobs need a remote run before their results can be reported as
passed. This Windows host currently has no JDK, Android SDK, or adb, so it
cannot run a local Gradle APK or physical Android journey. The new code has not
been checked in Safari or on a physical iOS device. Building an installer and
launching the unpacked app do not prove installation behavior on a target
machine.
