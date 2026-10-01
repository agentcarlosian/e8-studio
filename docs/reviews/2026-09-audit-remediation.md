# September 30 audit remediation

The owner authorized the audit fixes in priority order. This work continues
the local `codex/e8-studio-improvements` branch. It has not been pushed or
deployed.

## Implemented

- The quasicrystal's visible-plane scale now depends on its reach and projection,
  not on which points happen to pass the current window. Comparison uses a
  common scale across reach changes, fits departing points, displays sampled
  intensity through dot size/brightness, and preserves mode-specific point
  sizes. Tests pin retained-point positions and exact edge-list parity.
- Nearby Window/Phason changes update finite structure-factor sums for entering
  and leaving points, with a full recomputation after large changes or 32
  incremental steps. A bounded short-radius pass accelerates dense Pattern
  links and falls back to the original search when needed.
- Web startup fetches only core E8 data. Other view data loads with the view;
  failed fetches can be retried and the E8 fallback repairs saved state. Hosted
  web builds include the existing Canvas2D mobile Studio for no-WebGL recovery.
  A standalone file gives accurate guidance without offering a missing link.
- Capacitor reads a clean `dist/mobile` directory containing only its inlined
  HTML. The optional PWA cache revision follows built bytes, checks for fresh
  HTML online, and retains an offline navigation fallback.
- Mobile lessons follow the shared prerequisite-respecting curriculum order and
  can reopen any experiment step. Desktop Learning Center search, library
  position, and same-lesson disclosures survive rerenders; the guided coach
  receives keyboard focus. Diffraction copy describes sampled finite-patch
  intensities without claiming that the Studio measures peak sharpness.

## Focused evidence

- Quasicrystal, comparison, curriculum, content, deferred-view, syntax, and
  model/export contract checks passed. Optimized diffraction intensities were
  compared with independent full calculations across window, phason, reach,
  cache revisit, and periodic refresh steps.
- Source and built-web fault injection passed for missing nondefault data,
  failed deferred modules, persisted recovery, and no-WebGL Canvas2D routing.
  Standalone file boot and no-WebGL guidance passed.
- Four-size Studio and Learning Center journeys, 67/67 robustness checks,
  dedicated mobile smoke, the two-build PWA update test, and native asset
  inventory passed.
- `npx cap sync android` succeeded locally. The synced public assets contained
  the staged `index.html` plus two zero-byte Capacitor shim files; the staged
  and synced HTML SHA-256 values matched. No APK was built.

## Performance and remaining work

Short local Node samples near the maximum window measured nearby Diffraction
changes at 5.1 ms median with the bounded update versus 167.3 ms for separate
full calculations. The first full Diffraction calculation was about 144 ms.
Dense Pattern links improved from 359.8 ms to 86.2 ms median with unchanged
sampled edge lists. Those numbers depend on CPU/load and do not guarantee a
device frame rate. Dense Pattern dragging still exceeds a 16 ms frame budget;
an incremental graph or staged rendering needs separate design and testing.

The legacy Python module rewriter remains in the standalone build path.
Physical Android, Safari/iOS, Electron installer, and a Gradle APK were not
tested. The clean-commit release gate and remote CI are separate checks; no
remote branch or public site was changed during this work.
