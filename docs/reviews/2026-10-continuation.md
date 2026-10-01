# October 1 continuation

The owner asked to continue the September audit work. These changes are on the
local `codex/e8-studio-improvements` branch; no branch, binary, or site was
published.

## Completed

- The default offline/PWA/Electron and share builders now inline one Vite ESM
  graph instead of rewriting module text with regular expressions. The old
  path remains available as `build:legacy` for comparison. The new share HTML
  is about 2.53 MB versus 4.21 MB before the migration and boots when copied
  outside `dist/`. Production/candidate bytes, camera and geometry exports,
  deferred 4D views, and an actual PWA revision upgrade with offline reload
  passed focused parity tests. Electron packaging no longer needs vendor
  sidecars.
- Dense Quasicrystal Pattern links use a typed spatial grid and bounded search
  with an exact fallback. Reusing palette scales and repeated colors, and
  formatting point tooltips on hover, reduced local headless Chromium median
  `currentView.update` time from 352.5 to 40.7 ms at about 14,000 points and
  from 288.4 to 29.2 ms at about 9,700 points. Sixty ordered edge-list states
  matched the previous implementation; visual palette samples and a real
  canvas hover retained their output.
- WebKit engine checks passed at desktop and phone widths and through the
  button-driven Canvas2D fallback. Android APK, Electron ASAR, and packaged
  Electron runtime checks were added to CI. A local NSIS installer and portable
  executable were built through an ignored pre-extracted runtime override;
  the ASAR matched the offline HTML and the unpacked app opened E8, a 4D view
  while offline, and a beginner lesson without renderer errors.

## Verification and limits

The clean `npm run release:check` passed on code commit `79f890f`: full source,
web, offline/share, browser, learning, background, 67-check robustness, and
45-download export gates. The Python math suite, desktop/phone WebKit smoke, Mobile
V2 smoke, and final Capacitor sync also passed. The staged and synced Android
HTML SHA-256 values matched.

Dense Pattern rendering can still lag: the browser's post-render animation
frame proxy varied, and software WebGL render calls had slower outliers. A
persistent geometry/buffer update strategy would be a larger follow-up with
visual and lifecycle parity requirements. The first full Diffraction calculation
also remains full work.

The ordinary local `npm run electron:dist` path failed twice with Windows
`EPERM` during Electron Builder's extraction rename; a documented
`electronDist` override completed the local package build. The installer was
not signed or installed. This host lacks an Android SDK/JDK/adb, so no APK or
physical Android run was completed here. The new CI package jobs have not run
remotely. Playwright WebKit is not Safari on a physical Apple device. See
`docs/reviews/2026-10-platform-verification.md` for the platform matrix.
