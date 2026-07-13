# Build and platform boundaries

E8 Studio uses a standard module-aware web build while preserving standalone,
Electron, and Android artifacts through separate verified build paths.

## Build outputs

| Output | Command | Current implementation | Role |
| --- | --- | --- | --- |
| Web | `npm run build:web` | Vite 8, npm-pinned dependencies | Primary hosted build |
| Legacy inline | `npm run build:legacy` | Python module rewriter | Compatibility baseline |
| Offline/PWA | `npm run build:offline` | Legacy inline + vendored dependencies | Existing Electron/PWA input |
| Desktop share | `npm run build:single` | Fully inlined HTML | File-sharing artifact |
| Mobile native | `npm run build:mobile` | Canvas 2D HTML inliner | Capacitor input |
| Mobile share | `npm run build:mobile:single` | Canvas 2D standalone HTML | Phone-sharing artifact |

The Vite build is emitted to `dist/web/`, uses relative asset URLs, bundles the
runtime JavaScript dependencies from `package-lock.json`, and copies canonical
JSON into `dist/web/data/`. Its built HTML contains no runtime jsDelivr import
map or CSP allowance.

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

- Canvas 2D renderer
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

1. Vite and legacy outputs must pass the same browser behavior checks before
   the default `build` command changes.
2. New desktop modules must be reachable through normal ESM imports; they must
   not be added only to `scripts/build.py::JS_FILES`.
3. Shared-core modules may be consumed by both shells, but renderer objects may
   never enter shared state.
4. Generated data must have one writer and deterministic verification.
5. No build is allowed to make an undocumented mutation to an installed npm
   dependency.

## Known migration blockers

- The legacy single-file format still depends on regex-based ESM rewriting and
  a manually ordered `JS_FILES` list.
- `src/main.js` and `src/mobile/main.js` still own significant UI orchestration.
  Future extraction should preserve the platform-neutral `ResourceScope`
  ownership and the existing lifecycle contracts.
- The mobile build no longer edits Capacitor source under `node_modules`.
  Safe-area behavior is owned by the mobile shell CSS and the pinned Capacitor
  integration; upstream regressions must fail verification instead of being
  silently patched during a build.
- Vite separates desktop rendering/views and learning content from the shell
  bootstrap. Dynamic, on-demand view loading remains a measured
  optimization opportunity, but no longer blocks clear package ownership.
- Dependency security is checked before release; Electron and electron-builder
  upgrades require packaging regression tests in addition to the web suite.
