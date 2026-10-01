# Studio improvement plan

This plan records the September 2026 implementation requested by the owner. The
primary surface is the hosted desktop Studio; changes must preserve standalone,
Electron, and mobile build contracts where shared code is involved.

## Acceptance criteria

1. A first-time visitor sees clear routes to explore geometry, follow beginner
   lessons, or make a visual. Opening the Studio does not silently change scenes.
2. Quasicrystal Pattern, Window, and Diffraction can be compared with the same
   reach, window, and phason parameters. Changes in accepted points and
   diffraction are explained with accurate scope and usable on narrow screens.
3. Status and mathematical labels reflect the active view. Explanatory McKay
   language stays qualified; the order-30 Coxeter action is named precisely.
4. First-render and first-view-switch cost are measured before lazy loading.
   Any loading change preserves view switching, error recovery, and build parity.
5. View switching or command dispatch is extracted from `src/main.js` in a
   narrow step while preserving lifecycle ownership and existing commands.
6. After the five changes: review bugs, graphics/rendering, and UI. Fix concrete
   issues found, and overhaul Learning Center navigation, visual hierarchy, and
   beginner-facing content while retaining sources, quizzes, experiments, and
   saved progress.

## Stages

- [x] Establish baseline builds and targeted tests; map first-run, view,
      persistence, render, and learning contracts.
- [x] First-run routes and precise active-view labels.
- [x] Linked quasicrystal comparison and focused validation.
- [x] Measured loading improvement and narrow orchestration extraction.
- [x] Bug, rendering, and UI sweep; Learning Center redesign and content pass.
- [x] Full relevant release checks, browser visual review at desktop and narrow
      sizes, documentation, and handoff with remaining limitations.

## Constraints and decisions

- No automatic deployment or external publication is included in this plan.
- Preserve mathematical data and keep interpretations and visual design choices
  clearly labeled.
- Prefer existing dependencies and browser APIs.
- Python 3.12 is not installed locally; baseline math tests passed with Python
  3.13.12. The repository CI runs Python 3.12.
- A local three-run Chromium comparison measured 1,202,610 bytes of initial JS
  before view splitting and 1,122,381 after. Median first-frame time was
  179.1 ms before and 175.9 ms after; the first 4D view switch increased from
  8.6 ms to 31.3 ms. These are short local samples, not device guarantees.
- Full verification, 67/67 robustness checks, the 30-scene background sweep,
  and the dedicated mobile smoke passed. The review and remaining limits are in
  `docs/reviews/2026-09-studio-improvement-review.md`.

## September 30 audit remediation

The owner authorized implementation in the audit's recommended order. This is
a new phase on the same local branch; the preceding plan and checks remain the
baseline, not evidence that the issues below are already fixed.

- [x] Keep a retained quasicrystal point at a stable screen coordinate as the
      window or phason changes. Use a consistent comparison scale, preserve
      mode-specific point sizes, and test clipping on reach changes.
- [x] Let E8 start when an unopened view's dataset fails. Give no-WebGL users
      an effective recovery path, and persist the successful fallback when a
      deferred view module fails.
- [x] Stage only mobile assets for Capacitor; verify the copied inventory.
- [x] Derive mobile lesson order from prerequisite-respecting curriculum data.
      Preserve contextual entry and test Next/Previous ordering.
- [x] Measure and improve worst-case comparison slider latency without changing
      the finite-patch math or overstating sampled diffraction.
- [x] Make offline PWA revisions follow built content and test an upgrade over
      two builds.
- [x] Preserve Learning Center search/scroll state, coach focus, and mobile
      per-step experiment access; tighten the two identified math labels.
- [ ] Simplify the legacy standalone build path only after output parity is
      demonstrated; add native packaging and browser/device gates as feasible.
- [x] Run focused tests after each slice, then full source, web, standalone,
      mobile, rendering, and release checks on a clean local commit. Record
      limits and do not push or deploy without a separate decision.

Focused checks passed for the completed items, including local source and built
fault injection, four-size Studio/Learning Center journeys, mobile smoke,
standalone file:// boot/fallback, exact native staging, and a two-build PWA
upgrade. The clean local `npm run release:check` passed on the implemented code
at `b3a6ccb`, including the 67 robustness checks, 30-scene graphics sweep,
share-file boot, and 45 digital export downloads. A dense Pattern patch still
takes about 86 ms per nearby change in a local Node sample, above a 16 ms frame
budget; first Diffraction computation also remains full work. Legacy build
migration, physical-device/browser matrix, and installer packages remain
separate follow-up work.
