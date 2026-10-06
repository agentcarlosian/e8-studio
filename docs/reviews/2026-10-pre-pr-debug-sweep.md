# Pre-PR debug sweep — October 5, 2026

This sweep reviewed the local `codex/e8-studio-improvements` branch before a
pull request. It exercised local source and built artifacts; it did not test a
deployed site or run remote CI.

## Fixed and covered

- Bounded the 4D perspective denominator at supported depth and rotation
  values. Former 24-cell nonfinite coordinates and 120-cell spikes now have
  finite, bounded vertex and edge buffers across all six regular 4-polytopes.
- Replaced Trail FX's destructive point-color decay with a bounded shader band.
  Source colors survive 240 Trail frames, palette changes, and switching FX
  back to None in all six affected views. A browser check now compiles Root
  Lab with Trail and rejects console shader errors.
- Restored the canonical Coxeter root scale after 3D projection changes and
  synchronized main chords plus Petrie, Cartan, and picked-neighbor overlays
  after Extrude or selection changes. Focused tests compare line endpoints to
  their live roots.
- Preserved keyboard focus through mobile Learning Center path rerenders and
  kept focus inside the mobile Settings dialog until close or Back. The full
  Mobile V2 smoke passed with these keyboard checks.
- Added an all-24-gallery browser gate that waits for view readiness and checks
  finite geometry, attached scenes, nonblank canvases, and clean errors.
- Shipped canonical SVG and 192/512 PNG PWA icons, checked every manifest icon
  and offline fetch, and isolated service-worker caches by registration scope.
  A two-install test upgraded one path without evicting the other's offline
  cache. The release manifest now authenticates all three icons.
- Escaped closing script tags in inlined mobile JSON; a synthetic lesson value
  containing mixed-case `</ScRiPt>` round-tripped safely.

## Validation

The clean `npm run release:check` passed on code commit `7c7a1d6`, including
the expanded 14-stage verifier, 67 robustness checks, 24 gallery scenes, 30
backgrounds, copied-file/PWA parity, standalone fallback, and 45 export
downloads. `python scripts/test_math.py` and `npm run smoke:mobile-v2` also
passed. The verifier stages took 768.9 seconds locally; the Linux CI timeout
was raised from 20 to 30 minutes to allow for setup plus the expanded checks.

## Remaining limits

- The new Android and Electron package jobs have not run remotely; a PR will
  provide their first CI results. Physical Android, Safari/iOS, and installed
  Electron behavior still require those target environments.
- Old unscoped PWA cache names may remain in CacheStorage after an update.
  Their names do not identify which install on a shared origin owns them, so
  deleting them automatically could evict another installation. New caches
  are scope-specific and update independently.
- Six old, non-gated debug scripts remain as historical probes. Five hardcode
  another developer's Chromium path; the camera-view probe has outdated view
  labels. The maintained gate now covers their major behavior, including all
  gallery scenes; these scripts should be retired or modernized separately.
- Dense Pattern dragging still has variable render time on software WebGL.
  The existing performance review records the measured improvement and the
  larger persistent-buffer work that would be needed for steadier frames.

The Pages deployment job intentionally waits for the Linux web verifier and
Windows build checks. Android and Electron package jobs are separate CI
results; they do not block publishing the web artifact.
