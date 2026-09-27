# September 2026 Studio improvement review

## Scope

Reviewed the desktop source, web and standalone builds, first-run navigation,
Learning Center, view loading, quasicrystal comparison, background rendering,
effects, exports, and the dedicated mobile shell. This review used local data,
headless Chromium, and generated captures. It did not test physical devices or
publish a new build.

## Changes and confirmed bugs fixed

- First-time visitors can choose a geometry tour, a beginner lesson, or a
  curated visual. Status labels now describe the active selection, and McKay
  highlighting is identified as interpretive.
- Quasicrystal Pattern, Window, and finite-patch Diffraction now share one
  selection in a linked comparison. A baseline tracks points entering and
  leaving and sampled peak-intensity changes. The phone controls drawer closes
  when comparison opens, exposing the panel and moving keyboard focus to it.
- Web view factories load nondefault renderers on first selection and cache
  them. The default E8 view stays ready at startup. Self-contained artifacts
  resolve the same definitions to synchronous inlined factories. A redundant
  first view construction in lesson experiments was removed.
- The Learning Center now opens on a question-led home. Lessons lead with a
  beginner-facing purpose and worked example, then vocabulary, experiment,
  check, and collapsible sources. The shared mobile curriculum and reader use
  the same new lesson purpose statements. A CSS rule that left sources visible
  while their disclosure was closed was fixed.
- A file-URL smoke test contained a hardcoded path to a different user's
  machine; it now discovers the local browser and tests the generated desktop
  artifact. The mobile smoke script's invalid Python escape was fixed.

## Rendering and verification evidence

- `python scripts/verify.py` passed every stage after the desktop changes:
  builds, syntax, math and content, model exports, browser parity, four-size UI
  journeys, 30 background scenes, and the integrated release journey.
- `python scripts/test_robustness.py` passed 67/67 checks, including view
  disposal, effects, motion, quality, and touch recovery.
- `npm run smoke:mobile-v2` passed after the mobile lesson update.
- Representative Mandala, Plasma, Tide, and Quantum background captures and
  foreground-over-background journey captures were inspected. The tested
  scenes rendered without a blank canvas, clipped foreground, or illegible
  canvas labels. This is a sample, not a judgment about every visual choice.
- `npm audit --omit=dev --json` reported zero runtime-dependency
  vulnerabilities at the time of this review.

## Loading tradeoff

In a three-run local Chromium sample, initial JavaScript transfer fell from
1,202,610 to 1,122,381 bytes. Median first frame was 179.1 ms before and
175.9 ms after; the first 4D view switch increased from 8.6 ms to 31.3 ms.
These are local short-run measurements. Device and network results may differ.

## Limits

The browser and mobile checks used local headless Chromium and simulated
viewports. Physical Android, iOS/Safari, Electron installer packaging, and
long-duration GPU or battery behavior were not measured in this review.
