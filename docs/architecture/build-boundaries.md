# Build and platform boundaries

E8 Studio uses a standard module-aware web build while preserving standalone,
Electron, and Android artifacts through separate verified build paths.

## Build outputs

| Output | Command | Current implementation | Role |
| --- | --- | --- | --- |
| Web | `npm run build:web` | Vite 8, npm-pinned dependencies | Primary hosted build |
| Legacy inline | `npm run build:legacy` | Retained Python module rewriter | Comparison baseline only |
| Offline/PWA/Electron | `npm run build:offline` (also `npm run build`) | Vite one-chunk ESM bundle + inline CSS/data | Local-only `dist/index.html`; service worker and manifest beside it |
| Desktop share | `npm run build:single` | Same Vite bundle + inline CSS/data | Portable `dist/e8-studio.html` with no sibling files |
| Mobile native | `npm run build:mobile` | Vite ESM bundle + hybrid Canvas/WebGL HTML | Clean `dist/mobile/index.html` is Capacitor input; `dist/index.html` remains for browser smoke tests |
| Mobile share | `npm run build:mobile:single` | Same Vite bundle + standalone HTML | Phone-sharing artifact |

The hosted Vite build emits `index.html` and a Canvas2D `mobile.html` fallback under
`dist/web/`, uses relative asset URLs, bundles runtime JavaScript dependencies
from `package-lock.json`, and copies canonical JSON into `dist/web/data/`.
Only the core E8 data is fetched at desktop startup; other datasets and
renderers load when their view is selected. The default E8 renderer is ready at
startup, and loaded view factories are cached for later selections.
The built HTML contains no runtime jsDelivr import map or CSP allowance. The
offline and share outputs compile the same ESM graph through
`scripts/bundle_desktop.mjs`, inline seven view datasets, and embed the resulting
single script and styles. Deferred view imports remain asynchronous at the API
boundary but need no external chunk request. The offline page precaches only
itself, its manifest, and the committed SVG and 192/512 PNG icons. Electron
packages `dist/index.html` without a `dist/vendor` dependency. The share file
can be copied outside the repository
and opened directly through `file://` without redirecting to `dist/`.
When changing `assets/pwa-icon.svg`, regenerate both `assets/pwa-icon-*.png`
from it with `scripts/gen_pwa_icons.py` and check them with `--check`; the
regular build copies the committed icons without starting a browser.

`npm run mobile:build` syncs only `dist/mobile/` into Capacitor. The mobile
builder replaces that directory with one inlined `index.html`; unrelated
`dist/` files such as release manifests, share files, and web assets stay out
of the Android package. The optional PWA uses a cache name derived from its
built HTML, local assets, and registration scope, so two installs on one origin
keep separate offline caches. Online navigations fetch fresh HTML, and offline
navigations use the cached page. `python -B scripts/test_packaging_assets.py`
checks the staging contract and a two-build PWA update in local Chromium as
part of the normal verifier. After `npm run build:mobile`,
`python -B scripts/test_packaging_assets.py --native-only` checks the actual
Capacitor input; both Linux and Windows CI run that inventory gate. This does
not build an APK or desktop installer.

## Intended code ownership

### Shared core

Code in this layer must not access DOM, WebGL, Canvas, Electron, Capacitor, or
browser storage directly.

- Canonical data schemas and validation
- E8, Weyl, Cartan, projection, and polytope math
- Palette definitions and semantic color roles
- Gallery/preset schemas
- Educational content, source ledger, and lesson schemas
- Serializable app/session state
- Export document and geometry serializers

### Desktop shell

- Three.js/WebGL renderer and view implementations
- Desktop control panel, overlays, modals, keyboard commands
- Desktop camera and renderer lifecycle
- Browser/Electron delivery adapters

### Mobile shell

- Canvas 2D renderer for points, meshes, Bloom, and backgrounds
- Raw WebGL raymarcher for the E8 SDF view
- Touch gestures, safe areas, bottom-sheet navigation
- Mobile performance policy and scene shortcuts
- Capacitor delivery/share adapter

### Platform adapters

Side effects cross the shared-core boundary through explicit adapters:

- persistence
- download/share
- recording and codecs
- clock and animation scheduling
- visibility and lifecycle
- diagnostics

## Migration rules

1. The hosted Vite, offline, and share outputs must pass the same browser
   behavior checks before changing the default `build` command.
2. New desktop modules must be reachable through normal ESM imports; they must
   not be added only to `scripts/build.py::JS_FILES`.
3. Shared-core modules may be consumed by both shells, but renderer objects may
   never enter shared state.
4. Generated data must have one writer and deterministic verification.
5. No build is allowed to make an undocumented mutation to an installed npm
   dependency.

## Known migration blockers

- `build:legacy` retains the regex-based ESM rewriter and a manually ordered
  `JS_FILES` list as a comparison baseline. It is no longer a release input.
- `src/main.js` and `src/mobile/main.js` still own significant UI orchestration.
  Future extraction should preserve the platform-neutral `ResourceScope`
  ownership and the existing lifecycle contracts.
- The mobile build no longer edits Capacitor source under `node_modules`.
  Safe-area behavior is owned by the mobile shell CSS and the pinned Capacitor
  integration; upstream regressions must fail verification instead of being
  silently patched during a build.
- Vite separates the default visual core from nondefault view modules. A local
  three-run Chromium sample showed about 80 KB less initial JavaScript with a
  first 4D view switch increasing from 8.6 ms to 31.3 ms; device results need
  separate measurement. The large default Three.js core remains a loading cost.
- Dependency security is checked before release; Electron and electron-builder
  upgrades require packaging regression tests in addition to the web suite.

## Extracted module contracts

- `src/services/geometry-export.js` serializes SVG, OBJ and canonical geometry
  using only supplied data and scene parameters. Desktop delivery remains in
  `ExportRecordingService`; serializers do not own renderer or storage state.
- `src/mobile/state.js` owns mobile defaults, configuration migrations,
  normalization and camera limits. The mobile shell supplies current curriculum
  identifiers and retains persistence and event handling.
- `scripts/bundle_mobile.mjs` compiles the mobile ESM graph for both Python HTML
  builders. Node and installed Vite dependencies are required. The bundler
  rejects external imports or extra chunks so standalone output remains local.
- `src/ui/quick-start.js` owns the opt-in guide's DOM, focus and dismissal
  lifecycle. Scene changes cross its injected `applyStep` adapter; it never
  changes a scene merely because the application starts.
- Ambient camera noise uses the same npm module in web and standalone outputs.
  Browser verification checks drift and geometry exports on each output.
- `src/ui/learning-center.js` renders the desktop lesson reader and owns local
  home, search, section navigation, responsive library behavior, and the angle-rule
  calculator. Its cleanup releases the media-query listener on replacement or
  dismissal. The shell retains progress writes, quizzes, and Studio actions.
- `src/platform/view-factories.js` owns the view registry and dynamic imports.
  `src/platform/deferred-view.js` holds a temporary view until its renderer
  arrives and cancels late construction after disposal. The standalone bundle
  includes these modules in one inlined script.
- `src/content/lesson-guides.js` adds vocabulary, examples, misconceptions, and
  retrieval questions to every curriculum lesson. The curriculum generator
  includes these additive fields in the mobile artifact, keeping teaching notes
  identical across readers. Existing lesson identifiers and progress are stable.
- `scripts/test_learning_center.py` exercises the reader at four viewport sizes,
  including filtering, the corner calculator, quiz recovery, experiment resume,
  keyboard focus, and persistence. It runs in the studio UI verification stage.

The desktop legacy rewriter remains a compatibility baseline. New extractions
must use normal ESM imports and pass hosted, PWA, copied-file, and Electron
package gates.
See [verified deployment](verified-deployment.md) for the CI-to-Pages contract.
