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
  a bundled `dist/vendor` sidecar.

## CI package gates added

- `android-package` builds and syncs the clean Capacitor input, assembles an
  unsigned debug APK, and checks that `assets/public/index.html` exactly
  matches both the staged and synced HTML. It rejects unrelated public assets.
  The project pins Android Gradle Plugin 8.13; [Google's compatibility table](https://developer.android.com/build/releases/agp-8-13-0-release-notes)
  calls for JDK 17 and SDK Build Tools 35.0.0. CI installs API 36, matching
  `android/variables.gradle`.
- `windows-build` now runs a WebKit engine smoke after the web build.
- `electron-package` builds the Windows Electron installer and verifies that
  the unpacked ASAR contains the exact offline HTML and no vendor sidecars.

These new CI jobs need a remote run before their results can be reported as
passed. This Windows host currently has no JDK, Android SDK, adb, or Electron
executable, so it cannot run a local Gradle APK, installer, or physical Android
journey. The new code has not been checked in Safari or on a physical iOS
device. A packaged binary check also does not substitute for installing and
using that binary on a target machine.
