#!/usr/bin/env python3
"""Regression suite for the robustness fixes the fuzzer can't catch.

The action-fuzzer (scripts/fuzzer.py) is great at "does a random action sequence
throw?" but blind to silent issues: resource leaks, out-of-range state from a
crafted config, dead toggles, and GLSL that only fails when a specific FX mode
meets a specific view. This suite pins those down so they can't regress:

  1. FX material set stays bounded across many view switches (no leak).
  2. A hostile #config= link is clamped (but periodic accumulator angles are not).
  3. Every view-compatible FX mode activates with no console error (shader sanity).
  4. data-act / data-param delegation works under the strict (no-unsafe-inline) CSP.
  5. Adaptive pixel-ratio restores native DPR when toggled off.
  6. Persisted actions write their final state to localStorage.
  7. Desktop and touch-shell DPR budgets remain separate and shader sizes track
     the renderer's real DPR.

Run: python scripts/test_robustness.py
Exit 0 = all pass.
"""
from __future__ import annotations

import base64
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from verify import chromium_webgl_args, start_server, find_chromium_executable  # noqa: E402

FX_MODES = ['none', 'glow', 'pulse', 'trail', 'chromatic', 'kaleidoscope', 'ripple',
            'spiral', 'fog', 'heat', 'edge-glow', 'aura', 'voronoi', 'caustic',
            'iridescent', 'flowfield', 'plasma', 'kaleido6', 'dof', 'nebula',
            'wireframe', 'hologram', 'xray', 'crystal']
VIEWS = ['bloom', 'platonic', 'e8coxeter', 'sixhundred', 'polytope', 'raymarched', 'rootlab', 'dynkin']
SDF_FX_MODES = FX_MODES

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"  {'ok  ' if ok else 'FAIL'} {name}{('  -- ' + detail) if detail and not ok else ''}")


def main() -> int:
    print("Building dist...")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build.py")], check=True,
                   stdout=subprocess.DEVNULL)

    from playwright.sync_api import sync_playwright
    httpd, base = start_server()
    exe = find_chromium_executable()
    try:
        with sync_playwright() as p:
            args = {"headless": True, "args": chromium_webgl_args()}
            if exe:
                args["executable_path"] = exe
            browser = p.chromium.launch(**args)

            # ---- 2. Hostile config is clamped (load with a crafted hash) ----
            cfg = {"bgIntensity": 9999, "cameraSpeed": 1e6, "fxIntensity": 50,
                   "opacity": 99, "e8Spin": 1e9}
            code = (base64.b64encode(json.dumps(cfg).encode()).decode()
                    .replace('+', '-').replace('/', '_').rstrip('='))
            pg = browser.new_page()
            pg.add_init_script("window.__forceSdfSafeMode = true")
            pg.goto(f"{base}/dist/index.html#config={code}", wait_until="commit", timeout=20000)
            pg.wait_for_function("() => !!(window.__app && window.__app.params)", timeout=20000)
            prm = pg.evaluate("() => window.__app.params")
            check("config clamp: bgIntensity<=1.5", prm["bgIntensity"] <= 1.5 + 1e-9, str(prm["bgIntensity"]))
            check("config clamp: cameraSpeed<=5", prm["cameraSpeed"] <= 5 + 1e-9, str(prm["cameraSpeed"]))
            check("config clamp: fxIntensity<=1", prm["fxIntensity"] <= 1 + 1e-9, str(prm["fxIntensity"]))
            check("config: accumulator e8Spin NOT clamped", prm["e8Spin"] == 1e9, str(prm["e8Spin"]))
            pg.close()

            # ---- 1, 3, 4, 5 on a clean page ----
            pg = browser.new_page(viewport={"width": 1100, "height": 820})
            pg.add_init_script("window.__forceSdfSafeMode = true")
            console_errs: list[str] = []
            pg.on("console", lambda m: console_errs.append(m.text) if m.type == "error" else None)
            pg.on("pageerror", lambda e: console_errs.append(str(e)))
            pg.goto(f"{base}/dist/index.html", wait_until="commit", timeout=20000)
            pg.wait_for_function("() => !!(window.__app && window.__app.fxRuntime)", timeout=20000)
            pg.evaluate("() => document.getElementById('welcome-card')?.classList.add('hidden')")

            # ---- 1. No FX-material leak across view switches ----
            # (Each switch recompiles shaders under software GL, so keep the count
            # modest — 3 full cycles is plenty to expose unbounded growth.)
            SWITCHES = 18
            base_count = pg.evaluate("() => window.__app.fxRuntime.fxMaterials.size")
            for i in range(SWITCHES):
                pg.evaluate("(v) => window.__app.switchView(v)", VIEWS[i % len(VIEWS)])
                pg.wait_for_timeout(15)
            leak_count = pg.evaluate("() => window.__app.fxRuntime.fxMaterials.size")
            check(f"no FX leak across {SWITCHES} view switches",
                  leak_count <= max(4, base_count * 3), f"{base_count} -> {leak_count}")

            # ---- 3. Every compatible FX mode loads in its view (shader sanity) ----
            # Switching the view recompiles (1 compile/view); cycling FX modes in
            # a view is just uniform updates (cheap, no recompile).
            shader_fail = []
            for view in VIEWS:
                pg.evaluate("(v) => window.__app.switchView(v)", view)
                pg.wait_for_timeout(50)
                active_view = pg.evaluate("() => window.__app.params.view")
                if active_view != view:
                    shader_fail.append(f"{view}: switch landed on {active_view}")
                    continue
                compatible_modes = SDF_FX_MODES if view == 'raymarched' else FX_MODES
                for mode in compatible_modes:
                    before = len(console_errs)
                    pg.evaluate("(m) => window.__app.setFX(m)", mode)
                    pg.wait_for_timeout(15)
                    if len(console_errs) > before:
                        shader_fail.append(f"{view}/{mode}: {console_errs[-1][:80]}")
                    active_mode = pg.evaluate("() => window.__app.params.fxMode")
                    if active_mode != mode:
                        shader_fail.append(f"{view}/{mode}: activated {active_mode}")
            check("all view-compatible FX modes activate across all views",
                  not shader_fail, "; ".join(shader_fail[:4]))

            # Every model must survive every global quality tier. Use one effect
            # and background at the ceiling of each tier so this also verifies
            # that the global selector drives the shared capability policy.
            quality_matrix = pg.evaluate("""() => {
              const views = ['bloom', 'platonic', 'e8coxeter', 'sixhundred', 'polytope', 'raymarched', 'rootlab', 'dynkin'];
              const tiers = {
                low: {fx: 'glow', bg: 'starfield'},
                medium: {fx: 'trail', bg: 'aurora'},
                high: {fx: 'voronoi', bg: 'cosmos'},
              };
              const rows = [];
              for (const [quality, choices] of Object.entries(tiers)) {
                window.__app.setMobileQuality(quality);
                for (const view of views) {
                  window.__app.switchView(view);
                  window.__app.setFX(choices.fx);
                  window.__app.setBgMode(choices.bg);
                  window.__app.currentView?.update?.(0.016, performance.now() / 1000, window.__app.params);
                  rows.push({
                    quality,
                    view,
                    activeView: window.__app.params.view,
                    fx: window.__app.params.fxMode,
                    bg: window.__app.params.bgMode,
                    hasView: !!window.__app.currentView,
                    objectVisible: window.__app.currentView?.object3d?.visible !== false,
                  });
                }
              }
              window.__app.setMobileQuality('high');
              return rows;
            }""")
            matrix_fail = [row for row in quality_matrix if
                           row["activeView"] != row["view"]
                           or row["fx"] != {"low": "glow", "medium": "trail", "high": "voronoi"}[row["quality"]]
                           or row["bg"] != {"low": "starfield", "medium": "aurora", "high": "cosmos"}[row["quality"]]
                           or row["hasView"] is not True
                           or row["objectVisible"] is not True]
            check("all eight models render across Low, Balanced, and High quality",
                  not matrix_fail, str(matrix_fail[:3]))

            # Platonic faces must participate in the centralized FX pipeline,
            # and star polyhedra must retain their non-depth-writing material
            # path so transparent self-intersections do not flicker.
            surface_fx = pg.evaluate("""() => {
              window.__app.switchView('platonic');
              window.__app.setShape('icosahedron');
              window.__app.setFX('plasma');
              const convexFace = window.__app.currentView.object3d.getObjectByName('platonic-faces');
              const convexState = convexFace ? {
                tracked: window.__app.fxRuntime.fxMaterials.has(convexFace.material),
                mode: convexFace.material.uniforms?.uFXMode?.value,
                role: convexFace.material.userData?.surfaceRole,
                depthWrite: convexFace.material.depthWrite,
              } : null;
              window.__app.setShape('great_icosahedron');
              window.__app.setFX('plasma');
              window.__app.currentView.update(0.016, 2, window.__app.params);
              const starFace = window.__app.currentView.object3d.getObjectByName('star-polyhedron-faces');
              return {
                convex: convexState,
                star: starFace ? {
                  tracked: window.__app.fxRuntime.fxMaterials.has(starFace.material),
                  mode: starFace.material.uniforms?.uFXMode?.value,
                  role: starFace.material.userData?.surfaceRole,
                  depthWrite: starFace.material.depthWrite,
                  transparent: starFace.material.transparent,
                } : null,
              };
            }""")
            check("Platonic and star faces use the FX-aware surface paths",
                  surface_fx["convex"] == {
                    "tracked": True, "mode": 16, "role": "convex", "depthWrite": True
                  }
                  and surface_fx["star"] == {
                    "tracked": True, "mode": 16, "role": "star",
                    "depthWrite": False, "transparent": True
                  },
                  str(surface_fx))

            # ---- 4. Delegation works under strict CSP ----
            pg.evaluate("() => window.__app.switchView('platonic')")
            pg.wait_for_timeout(200)
            pg.click("[data-act='setShape'][data-arg='cube']")
            pg.wait_for_timeout(150)
            check("delegated click (data-act) works",
                  pg.evaluate("() => window.__app.params.shape") == "cube")
            # The input snaps to its step (0.05), so compare params against the
            # value the element actually holds, not the raw string we assigned.
            slid = pg.evaluate("""() => {
              window.__app.setPanelMode('style');
              const el = document.querySelector("input[type=range][data-param='fxIntensity']");
              if (!el) return null;
              el.value = '0.75'; el.dispatchEvent(new Event('input', {bubbles:true}));
              return { set: parseFloat(el.value), got: window.__app.params.fxIntensity };
            }""")
            check("delegated slider (data-param) works",
                  slid is not None and abs(slid["set"] - slid["got"]) < 1e-6,
                  str(slid))

            # ---- Product interaction regressions ----
            pg.evaluate("() => window.__app.switchView('platonic')")
            pg.wait_for_timeout(100)
            stack_absent = pg.evaluate("""() => !Array.from(document.querySelectorAll('.ps-subtitle'))
              .some(el => el.textContent.trim().toLowerCase() === 'stack mode')""")
            check("Platonic stack mode removed from UI", stack_absent)

            pg.evaluate("""() => {
              window.__app.setPanelMode('scene');
              window.__app.switchView('polytope');
              window.__app.setParam('morph4d', 0);
              window.__app.setPoly4d('tesseract');
              window.__app.currentView.update(0.016, performance.now() / 1000, window.__app.params);
            }""")
            pg.wait_for_timeout(600)
            tess = pg.evaluate("""() => {
              const points = window.__app.currentView.object3d.userData.vPoints;
              const a = points?.geometry?.attributes?.position?.array || [];
              const unique = new Set();
              for (let i = 0; i < a.length; i += 3) {
                unique.add(`${a[i].toFixed(4)},${a[i+1].toFixed(4)},${a[i+2].toFixed(4)}`);
              }
              return { depth: window.__app.params.morph4d, unique: unique.size };
            }""")
            check("tesseract defaults to cube-within-cube projection",
                  tess["depth"] > 0.5 and tess["unique"] == 16, str(tess))

            polytope_order = pg.evaluate("""() =>
              [...document.querySelectorAll('[data-act="setPoly4d"]')].map(button => button.dataset.arg)
            """)
            check("4D polytope selector places 120-cell before 600-cell",
                  polytope_order == ["5cell", "tesseract", "16cell", "24cell", "120cell", "600cell"],
                  str(polytope_order))

            polytope_controls = pg.evaluate("""() => ({
              subtitles: [...document.querySelectorAll('.ps-subtitle')].map(el => el.textContent.trim()),
              sliders: [...document.querySelectorAll('input[data-param]')].map(input => ({
                param: input.dataset.param,
                label: input.labels?.[0]?.textContent.trim(),
              })),
              animate: document.querySelector('[data-act="togglePolyAutoRotate"]')?.textContent.trim(),
              reset: document.querySelector('[data-act="resetPolyAngles"]')?.textContent.trim(),
            })""")
            expected_controls = {
                "morph4d": "4D depth", "polyRotationSpeed": "Rotation speed",
                "polyRotXY": "XY plane", "polyRotZW": "ZW plane",
                "polyRotXZ": "XZ plane", "polyRotYW": "YW plane",
                "polyRotXW": "XW plane", "polyRotYZ": "YZ plane",
            }
            actual_controls = {item["param"]: item["label"] for item in polytope_controls["sliders"]}
            check("4D controls explain projection, motion, and all six rotation planes",
                  all(label in polytope_controls["subtitles"] for label in
                      ["4D projection", "4D motion", "Rotation planes"])
                  and all(actual_controls.get(param) == label
                          for param, label in expected_controls.items())
                  and polytope_controls["animate"] in ["Animate 4D", "Pause 4D"]
                  and polytope_controls["reset"] == "Reset angles",
                  str(polytope_controls))

            camera_ui = pg.evaluate("""() => {
              const subtitles = Array.from(document.querySelectorAll('.ps-subtitle'))
                .map(el => el.textContent.trim());
              return {
                cameraIndex: subtitles.indexOf('Camera'),
                polyIndex: subtitles.indexOf('Polytope'),
                hasPathPresets: !!document.querySelector('[data-act="setCameraPath"]'),
                hasModePresets: !!document.querySelector('[data-act="setCameraMode"]'),
                hasBookmarks: !!document.querySelector('[data-act="saveCameraBookmark"], [data-act="loadCameraBookmark"]'),
                presets: Array.from(document.querySelectorAll('[data-act="setCameraPreset"]')).map(el => el.textContent.trim()),
                hasZoomSlider: !!document.querySelector('input[data-param="cameraDistance"]'),
                hasCameraDisclosure: !!document.querySelector('[data-panel-disclosure="camera-motion"]'),
              };
            }""")
            check("model controls precede fully visible camera utilities",
                  camera_ui["cameraIndex"] >= 0
                  and camera_ui["polyIndex"] >= 0
                  and camera_ui["polyIndex"] < camera_ui["cameraIndex"]
                  and camera_ui["hasCameraDisclosure"] is False
                  and camera_ui["hasPathPresets"] is False
                  and camera_ui["hasModePresets"] is False
                  and camera_ui["hasBookmarks"] is False,
                  str(camera_ui))
            check("camera keeps three useful presets and a real zoom slider",
                  camera_ui["presets"] == ["Orbit", "Dive", "Spiral"]
                  and camera_ui["hasZoomSlider"] is True, str(camera_ui))

            platonic_hierarchy = pg.evaluate("""() => {
              window.__app.switchView('platonic');
              const camera = [...document.querySelectorAll('.ps-subtitle')]
                .find(el => el.textContent.trim() === 'Camera');
              const motion = [...document.querySelectorAll('.ps-subtitle')]
                .find(el => el.textContent.trim() === 'Motion');
              const morph = document.querySelector('[data-panel-disclosure="shape-morph"]');
              const nodes = document.querySelector('[data-act="toggleVertices"]');
              return {
                cameraVisible: !!camera && camera.getClientRects().length > 0,
                motionVisible: !!motion && motion.getClientRects().length > 0,
                morphCollapsed: !!morph && !morph.open,
                cameraBeforeMorph: !!camera && !!morph
                  && camera.getBoundingClientRect().top < morph.getBoundingClientRect().top,
                nodesOutsideMorph: !!nodes && !nodes.closest('[data-panel-disclosure="shape-morph"]'),
                morphSliders: morph ? [...morph.querySelectorAll('input[type="range"]')]
                  .map(input => input.dataset.param) : [],
              };
            }""")
            check("Platonic promotes motion and demotes optional morph controls",
                  platonic_hierarchy["cameraVisible"] is True
                  and platonic_hierarchy["motionVisible"] is True
                  and platonic_hierarchy["morphCollapsed"] is True
                  and platonic_hierarchy["cameraBeforeMorph"] is True
                  and platonic_hierarchy["nodesOutsideMorph"] is True
                  and platonic_hierarchy["morphSliders"] == ["shapeTwist", "shapeSpike", "shapeJitter"],
                  str(platonic_hierarchy))

            # ---- Desktop shell, hierarchy, and accessibility regressions ----
            shell = pg.evaluate("""() => {
              window.__app.setPanelMode('style');
              const palettes = document.querySelectorAll('#desktop-palette-grid .swatch').length;
              const sliders = [...document.querySelectorAll('#panel input[type="range"]')];
              const unnamedSliders = sliders.filter(el => !el.labels?.length && !el.getAttribute('aria-label'));
              const footer = document.querySelector('.panel-footer');
              const footerChildren = [...footer.children];
              return {
                palettes,
                paletteToggle: document.querySelector('[data-panel-act="togglePaletteExpanded"]')?.textContent.trim(),
                unnamedSliders: unnamedSliders.map(el => el.dataset.param),
                footerChildren: footerChildren.length,
                directActions: footer.querySelectorAll(':scope > button').length,
                hasTools: !!footer.querySelector(':scope > details.panel-tools-menu'),
                footerHeight: Math.round(footer.getBoundingClientRect().height),
                canvasName: document.getElementById('canvas')?.getAttribute('aria-label'),
                liveStatus: document.getElementById('ps-status')?.getAttribute('aria-live'),
              };
            }""")
            check("desktop shell is compact and semantically named",
                  shell["palettes"] == 18
                  and shell["paletteToggle"] == "Expand all 45 palettes"
                  and shell["unnamedSliders"] == []
                  and shell["footerChildren"] == 6
                  and shell["directActions"] == 5
                  and shell["hasTools"] is True
                  and shell["footerHeight"] <= 90
                  and bool(shell["canvasName"])
                  and shell["liveStatus"] == "polite",
                  str(shell))

            global_quality = pg.evaluate("""() => {
              window.__app.switchView('platonic');
              window.__app.setPanelMode('style');
              window.__app.setMobileQuality('low');
              const low = {
                buttons: [...document.querySelectorAll('.ps-global-quality [data-act="setMobileQuality"]')]
                  .map(button => button.textContent.trim()),
                disabled: document.querySelectorAll('.fx-catalog-item:disabled').length,
                backgrounds: document.querySelectorAll('[data-section="style"] [data-act="setBgMode"]').length,
              };
              document.querySelector('.ps-global-quality [data-arg="high"]').click();
              const high = {
                quality: window.__app.params.mobileQuality,
                reduced: window.__app.params.reducedMode,
                disabled: document.querySelectorAll('.fx-catalog-item:disabled').length,
                backgrounds: document.querySelectorAll('[data-section="style"] [data-act="setBgMode"]').length,
              };
              window.__app.setPanelMode('learn');
              const persistsInLearn = !!document.querySelector('.ps-global-quality [data-arg="high"].on');
              window.__app.setPanelMode('style');
              return {
                low, high, persistsInLearn,
                toolsLabel: document.querySelector('[data-act="togglePerf"]')?.textContent.trim(),
              };
            }""")
            check("global quality selector is visible and unlocks FX from every workspace",
                  global_quality["low"]["buttons"] == ["Low", "Balanced", "High"]
                  and global_quality["low"]["disabled"] > 0
                  and global_quality["low"]["backgrounds"] == 4
                  and global_quality["high"]["quality"] == "high"
                  and global_quality["high"]["reduced"] is False
                  and global_quality["high"]["disabled"] == 0
                  and global_quality["high"]["backgrounds"] > global_quality["low"]["backgrounds"]
                  and global_quality["persistsInLearn"] is True
                  and global_quality["toolsLabel"] == "FPS overlay",
                  str(global_quality))

            gallery_reset = pg.evaluate("""() => {
              window.__app.setParam('showVertices', true);
              window.__app.setParam('pointScale', 2.4);
              window.__app.setParam('lightAmbient', 0.1);
              window.__app.toggleFXShift();
              window.__app.toggleAutoModel();
              window.__app.applyGalleryPreset('coxeter-rings');
              return {
                preset: window.__app.params.galleryPreset,
                vertices: window.__app.params.showVertices,
                pointScale: window.__app.params.pointScale,
                ambient: window.__app.params.lightAmbient,
                fxShift: window.__app.params.autoFx,
                modelShift: window.__app.params.autoModel,
                description: window.__app.getGalleryPresets().find(p => p.id === 'coxeter-rings')?.description,
              };
            }""")
            check("gallery presets clear inherited presentation state",
                  gallery_reset["preset"] == "coxeter-rings"
                  and gallery_reset["vertices"] is False
                  and gallery_reset["pointScale"] == 1
                  and gallery_reset["ambient"] == 0.55
                  and gallery_reset["fxShift"] is False
                  and gallery_reset["modelShift"] is False
                  and bool(gallery_reset["description"]),
                  str(gallery_reset))

            model_reset = pg.evaluate("""() => {
              window.__app.switchView('polytope');
              window.__app.setPoly4d('120cell');
              window.__app.setPanelMode('style');
              window.__app.setMobileQuality('high');
              window.__app.setPalette('rainbow');
              window.__app.setBgMode('cosmos');
              window.__app.setFX('glow');
              window.__app.setParam('showVertices', true);
              window.__app.setParam('pointScale', 2.4);
              window.__app.toggleFXShift();
              window.__app.toggleAutoModel();
              window.__app.resetConfig();
              const button = document.querySelector('[data-act="resetConfig"]');
              const stored = JSON.parse(localStorage.getItem('e8_studio_config_v1') || '{}');
              return {
                view: window.__app.params.view,
                poly4d: window.__app.params.poly4d,
                panelMode: window.__app.params.panelMode,
                quality: window.__app.params.mobileQuality,
                palette: window.__app.params.palette,
                bg: window.__app.params.bgMode,
                fx: window.__app.params.fxMode,
                vertices: window.__app.params.showVertices,
                pointScale: window.__app.params.pointScale,
                fxShift: window.__app.params.autoFx,
                modelShift: window.__app.params.autoModel,
                feedback: button?.classList.contains('is-confirmed') && button?.textContent.includes('Reset done'),
                storedView: stored.view,
                storedPoly: stored.poly4d,
              };
            }""")
            check("Reset preserves selection and quality while clearing visual state",
                  model_reset == {
                    "view": "polytope", "poly4d": "120cell", "panelMode": "style", "quality": "high",
                    "palette": "gold", "bg": "void", "fx": "none", "vertices": False,
                    "pointScale": 1, "fxShift": False, "modelShift": False, "feedback": True,
                    "storedView": "polytope", "storedPoly": "120cell",
                  }, str(model_reset))

            toggle_ui = pg.evaluate("""() => {
              window.__app.switchView('platonic');
              window.__app.setPanelMode('scene');
              const vertex = document.querySelector('[data-act="toggleVertices"]');
              const auto = document.querySelector('[data-act="toggleSliderAuto"][data-arg="cameraRotation"]');
              const vertexState = {
                styled: vertex?.classList.contains('ps-toggle-button') || false,
                track: vertex?.querySelectorAll('.ps-toggle-track, .ps-toggle-thumb').length || 0,
                text: vertex?.textContent.trim(),
                pressed: vertex?.getAttribute('aria-pressed'),
                width: vertex?.getBoundingClientRect().width || 0,
                height: vertex?.getBoundingClientRect().height || 0,
              };
              const autoState = {
                width: auto?.getBoundingClientRect().width || 0,
                height: auto?.getBoundingClientRect().height || 0,
              };
              window.__app.setPanelMode('style');
              const fx = document.querySelector('[data-act="toggleFXShift"]');
              return {
                vertex: vertexState,
                fx: {
                  styled: fx?.classList.contains('ps-toggle-button') || false,
                  track: fx?.querySelectorAll('.ps-toggle-track, .ps-toggle-thumb').length || 0,
                  text: fx?.textContent.trim(),
                  pressed: fx?.getAttribute('aria-pressed'),
                },
                auto: autoState,
              };
            }""")
            check("Vertex nodes and FX shift use the Studio switch treatment",
                  toggle_ui["vertex"]["styled"] is True
                  and toggle_ui["vertex"]["track"] == 2
                  and toggle_ui["vertex"]["text"] in ["On", "Off"]
                  and toggle_ui["vertex"]["pressed"] in ["true", "false"]
                  and toggle_ui["vertex"]["width"] >= 74
                  and toggle_ui["vertex"]["height"] >= 28
                  and toggle_ui["fx"]["styled"] is True
                  and toggle_ui["fx"]["track"] == 2
                  and toggle_ui["fx"]["text"] in ["On", "Off"]
                  and toggle_ui["fx"]["pressed"] in ["true", "false"]
                  and toggle_ui["auto"]["width"] >= 26
                  and toggle_ui["auto"]["height"] >= 26,
                  str(toggle_ui))

            palette_focus = pg.evaluate("""() => {
              const button = document.querySelector('[data-panel-act="togglePaletteExpanded"]');
              button.focus();
              button.click();
              return {
                count: document.querySelectorAll('#desktop-palette-grid .swatch').length,
                focus: document.activeElement?.dataset?.panelAct,
                expanded: document.activeElement?.getAttribute('aria-expanded'),
              };
            }""")
            check("palette expansion retains keyboard focus",
                  palette_focus == {"count": 45, "focus": "togglePaletteExpanded", "expanded": "true"},
                  str(palette_focus))

            focus_state = pg.evaluate("""() => {
              const space = document.querySelector('[data-act="setBgMode"][data-arg="starfield"]');
              space.focus();
              space.click();
              return {
                tag: document.activeElement?.tagName,
                act: document.activeElement?.dataset?.act,
                arg: document.activeElement?.dataset?.arg,
              };
            }""")
            check("panel focus survives state-driven rerenders",
                  focus_state == {"tag": "BUTTON", "act": "setBgMode", "arg": "starfield"},
                  str(focus_state))

            shortcut_state = pg.evaluate("""() => {
              const before = window.__app.params.paused;
              const tab = document.getElementById('panel-tab-style');
              tab.focus();
              tab.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true}));
              return {before, after: window.__app.params.paused};
            }""")
            check("Space on panel controls does not trigger the global pause shortcut",
                  shortcut_state["before"] == shortcut_state["after"], str(shortcut_state))

            modal_state = pg.evaluate("""() => {
              window.__app.setPanelMode('learn');
              const trigger = document.querySelector('[data-act="openLearningCenter"]');
              trigger.focus();
              trigger.click();
              const dialog = document.querySelector('#learning-modal .learning-dialog');
              const opened = !document.getElementById('learning-modal').classList.contains('hidden');
              dialog.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
              return new Promise(resolve => requestAnimationFrame(() => resolve({
                opened,
                closed: document.getElementById('learning-modal').classList.contains('hidden'),
                focusAct: document.activeElement?.dataset?.act,
              })));
            }""")
            check("learning dialogs close with Escape and restore focus",
                  modal_state == {"opened": True, "closed": True, "focusAct": "openLearningCenter"},
                  str(modal_state))

            command_focus = pg.evaluate("""() => {
              window.__app.setPanelMode('style');
              const trigger = document.getElementById('panel-tab-style');
              trigger.focus();
              window.__app.toggleCommandPalette();
              document.getElementById('command-palette').dispatchEvent(
                new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
              );
              return new Promise(resolve => requestAnimationFrame(() => resolve({
                closed: document.getElementById('command-palette').classList.contains('hidden'),
                focusId: document.activeElement?.id,
              })));
            }""")
            check("command palette restores focus after a panel rerender",
                  command_focus == {"closed": True, "focusId": "panel-tab-style"},
                  str(command_focus))

            camera_runtime = pg.evaluate("""() => {
              window.__app.setParam('cameraDistance', 4);
              window.__app.setParam('autoRotate', false);
              const zoomDistance = window.__app.camera.position.length();
              const zoomPath = window.__app.params.cameraPath;
              window.__app.setCameraPreset('dive');
              const dive = window.__app.params.cameraPath;
              window.__app.setCameraPreset('spiral');
              const spiral = window.__app.params.cameraPath;
              window.__app.setCameraPreset('orbit');
              return {
                zoomDistance, zoomPath, dive, spiral,
                orbitPath: window.__app.params.cameraPath,
                orbitRunning: window.__app.params.cameraOrbit,
                objectStill: !window.__app.params.autoRotate,
              };
            }""")
            check("camera zoom and presets are functional",
                  abs(camera_runtime["zoomDistance"] - 4) < 0.05
                  and camera_runtime["zoomPath"] == "manual"
                  and camera_runtime["dive"] == "ringDive"
                  and camera_runtime["spiral"] == "petrieSpiral"
                  and camera_runtime["orbitPath"] == "manual"
                  and camera_runtime["orbitRunning"] is True
                  and camera_runtime["objectStill"] is True,
                  str(camera_runtime))

            motion_ownership = pg.evaluate("""() => {
              window.__app.switchView('platonic');
              window.__app.setParam('rotationSpeed', 0.02);
              window.__app.setCameraMode('orbit');
              const cameraOwns = {
                orbit: window.__app.params.cameraOrbit,
                model: window.__app.params.autoRotate,
              };
              window.__app.toggleAutoRotate();
              const modelOwns = {
                orbit: window.__app.params.cameraOrbit,
                model: window.__app.params.autoRotate,
                path: window.__app.params.cameraPath,
              };
              window.__app.setCameraPath('petrieSpiral');
              return {
                cameraOwns,
                modelOwns,
                pathOwns: {
                  orbit: window.__app.params.cameraOrbit,
                  model: window.__app.params.autoRotate,
                  path: window.__app.params.cameraPath,
                },
              };
            }""")
            check("model rotation and camera orbit have one clear owner",
                  motion_ownership == {
                    "cameraOwns": {"orbit": True, "model": False},
                    "modelOwns": {"orbit": False, "model": True, "path": "manual"},
                    "pathOwns": {"orbit": False, "model": False, "path": "petrieSpiral"},
                  },
                  str(motion_ownership))

            zoom_slider = pg.evaluate("""() => {
              window.__app.setPanelMode('scene');
              window.__app.switchView('platonic');
              window.__app.setParam('autoSliders', ['cameraDistance']);
              const el = document.querySelector('input[data-param="cameraDistance"]');
              el.value = '9.25';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              return {
                param: window.__app.params.cameraDistance,
                actual: window.__app.camera.position.length(),
                autoStopped: !window.__app.params.autoSliders.includes('cameraDistance'),
                path: window.__app.params.cameraPath,
                orbit: window.__app.params.cameraOrbit,
              };
            }""")
            check("Zoom slider directly moves camera and stops competing motion",
                  abs(zoom_slider["param"] - 3.2) < 0.05
                  and abs(zoom_slider["actual"] - 3.2) < 0.05
                  and zoom_slider["autoStopped"]
                  and zoom_slider["path"] == "manual"
                  and zoom_slider["orbit"] is False,
                  str(zoom_slider))

            transition_state = pg.evaluate("""() => {
              window.__app.switchView('polytope');
              window.__app.setParam('polyAutoRotate', true);
              window.__app.setParam('autoRotate', true);
              window.__app.setParam('cameraOrbit', true);
              window.__app.setParam('cameraPath', 'petrieSpiral');
              window.__app.setParam('autoZoom', true);
              window.__app.setParam('autoSliders', ['morph4d', 'fxIntensity']);
              window.__app.switchView('platonic');
              const cleared = {
                poly: window.__app.params.polyAutoRotate,
                rotate: window.__app.params.autoRotate,
                orbit: window.__app.params.cameraOrbit,
                path: window.__app.params.cameraPath,
                zoom: window.__app.params.autoZoom,
                autos: window.__app.params.autoSliders.slice(),
              };
              window.__app.switchView('e8coxeter');
              window.__app.setParam('autoSliders', ['e8MorphT', 'fxIntensity']);
              window.__app.switchView('raymarched');
              return { cleared, sdfAutos: window.__app.params.autoSliders.slice() };
            }""")
            check("view switches replace all selection-owned motion and modifiers",
                  transition_state["cleared"] == {
                    "poly": False, "rotate": False, "orbit": False,
                    "path": "manual", "zoom": False, "autos": []
                  }
                  and transition_state["sdfAutos"] == [],
                  str(transition_state))

            poly_motion = pg.evaluate("""() => {
              window.__app.switchView('polytope');
              window.__app.setPoly4d('tesseract');
              window.__app.setParam('morph4d', 1.4);
              window.__app.resetPolyAngles();
              window.__app.setParam('rotationSpeed', 0);
              window.__app.setParam('polyRotationSpeed', 0.18);
              const view = window.__app.currentView;
              view.update(0.016, 1, window.__app.params);
              const attr = view.object3d.userData.edgeLines.geometry.attributes.position;
              const before = Array.from(attr.array);
              window.__app.togglePolyAutoRotate();
              view.update(1.0, 2, window.__app.params);
              const after = Array.from(attr.array);
              return {
                enabled: window.__app.params.polyAutoRotate,
                moved: before.some((v, i) => Math.abs(v - after[i]) > 1e-3),
                label: document.querySelector('[data-act="togglePolyAutoRotate"]')?.textContent.trim(),
                resetDepth: window.__app.params.morph4d,
                cameraSpeed: window.__app.params.rotationSpeed,
                polySpeed: window.__app.params.polyRotationSpeed,
              };
            }""")
            check("4D Animate button produces visible motion",
                  poly_motion["enabled"] is True and poly_motion["moved"] is True
                  and poly_motion["label"] == "Pause 4D"
                  and abs(poly_motion["resetDepth"] - 0.65) < 1e-9
                  and poly_motion["cameraSpeed"] == 0
                  and abs(poly_motion["polySpeed"] - 0.18) < 1e-9, str(poly_motion))

            pg.evaluate("""() => {
              window.__app.switchView('e8coxeter');
              window.__app.setE8Mode('coxeter');
              window.__app.setCompareMode('off');
            }""")
            pg.wait_for_timeout(600)
            highlight_off = pg.evaluate("""() => {
              let points = null;
              window.__app.currentView.object3d.traverse(o => {
                if (!points && o.isPoints && o.geometry?.attributes?.highlight) points = o;
              });
              return points ? Array.from(points.geometry.attributes.highlight.array).every(v => v === 0) : false;
            }""")
            check("E8 comparison highlighting has a real off state", highlight_off)

            extrude_ui = pg.evaluate("""() => ({
              count: document.querySelectorAll('input[data-param="e8MorphT"]').length,
              autoOn: document.querySelector('[data-act="toggleSliderAuto"][data-arg="e8MorphT"]')?.classList.contains('on') || false,
              cameraTop: Array.from(document.querySelectorAll('.ps-subtitle')).findIndex(el => el.textContent.trim() === 'Camera'),
              compareTop: Array.from(document.querySelectorAll('.ps-subtitle')).findIndex(el => el.textContent.trim() === 'Compare subset'),
            })""")
            check("Extrude is promoted beside E8 camera controls",
                  extrude_ui["count"] == 1
                  and extrude_ui["cameraTop"] >= 0
                  and extrude_ui["cameraTop"] < extrude_ui["compareTop"], str(extrude_ui))

            pg.evaluate("""() => {
              window.__app.params.autoSliders = [];
              window.__app.setParam('e8MorphT', 0.2);
              window.__app.toggleSliderAuto('e8MorphT');
              window.__app.switchView('raymarched');
            }""")
            pg.wait_for_timeout(700)
            sdf_extrude = pg.evaluate("""() => {
              const view = window.__app.currentView;
              const rings = view.object3d.material.uniforms.uRings.value;
              const autoClearedOnSwitch = !window.__app.params.autoSliders.includes('e8MorphT');
              window.__app.setParam('e8MorphT', 1);
              view.update(0.016, 1, window.__app.params);
              const expandedMax = Math.max(...rings.map(ring => Math.abs(ring.w)));
              const expanded = expandedMax > 0.001;
              window.__app.setParam('e8MorphT', 0);
              view.update(0.016, 2, window.__app.params);
              return {
                count: document.querySelectorAll('input[data-param="e8MorphT"]').length,
                expanded, expandedMax, ringCount: rings.length,
                reset: rings.every(ring => Math.abs(ring.w) < 1e-9),
                autoStopped: !window.__app.params.autoSliders.includes('e8MorphT'),
                autoClearedOnSwitch,
              };
            }""")
            check("SDF exposes shared Extrude and resets depth cleanly",
                  sdf_extrude["count"] == 1 and sdf_extrude["expanded"] is True
                  and sdf_extrude["reset"] is True and sdf_extrude["autoStopped"] is True
                  and sdf_extrude["autoClearedOnSwitch"] is True,
                  str(sdf_extrude))

            pg.evaluate("""() => {
              window.__app.switchView('e8coxeter');
              window.__app.setE8Mode('coxeter');
            }""")
            pg.wait_for_timeout(100)

            controls = pg.evaluate("""() => {
              window.__app.setParam('rootDiffusion', false);
              window.__app.setParam('pickedRoot', null);
              window.__app.toggleRootDiffusion();
              const diffusionStarted = window.__app.params.rootDiffusion;
              const diffusionOrigin = window.__app.params.pickedRoot;
              window.__app.setParam('showWeylMirrors', false);
              window.__app.setE8Mode('h4');
              const diffusionCleared = !window.__app.params.rootDiffusion;
              const selectionCleared = window.__app.params.pickedRoot == null;
              window.__app.toggleWeylMirrors();
              window.__app.currentView.update(0.016, performance.now() / 1000, window.__app.params);
              return {
                diffusionStarted,
                diffusionOrigin,
                diffusionCleared,
                selectionCleared,
                mirrors: window.__app.params.showWeylMirrors,
                mirrorMode: window.__app.params.e8ViewMode,
              };
            }""")
            pg.wait_for_timeout(600)
            controls["mirrorVisible"] = pg.evaluate("""() =>
              !!window.__app.currentView.object3d.getObjectByName('weyl-mirror-chamber')?.visible""")
            check("Diffusion and Mirrors act immediately",
                  controls["diffusionStarted"] is True and controls["diffusionOrigin"] == 0
                  and controls["diffusionCleared"] is True and controls["selectionCleared"] is True
                  and controls["mirrors"] is True and controls["mirrorMode"] == "coxeter"
                  and controls["mirrorVisible"] is True, str(controls))

            pg.evaluate("""() => {
              window.__app.setParam('e8Twin600', false);
              window.__app.setCompareMode('overlay');
              let points = null;
              window.__app.currentView.object3d.traverse(o => {
                if (!points && o.isPoints && o.geometry?.attributes?.highlight) points = o;
              });
              window.__twinBefore = Array.from(points.geometry.attributes.color.array);
              window.__app.toggleE8Twin600();
              window.__app.currentView.update(0.016, performance.now() / 1000, window.__app.params);
              window.__twinEnabled = window.__app.params.e8Twin600;
              window.__twinCompareCleared = window.__app.params.compareMode === 'off';
            }""")
            pg.wait_for_timeout(600)
            twin_atlas = pg.evaluate("""() => {
              let points = null;
              window.__app.currentView.object3d.traverse(o => {
                if (!points && o.isPoints && o.geometry?.attributes?.highlight) points = o;
              });
              const after = Array.from(points.geometry.attributes.color.array);
              window.__app.setParam('e8ProjectionAuto', false);
              window.__app.setE8Mode('coxeter');
              window.__app.toggleProjectionAuto();
              const result = {
                twin: window.__app.params.e8Twin600,
                compareMode: window.__app.params.compareMode,
                twinEnabled: window.__twinEnabled,
                twinCompareCleared: window.__twinCompareCleared,
                recolored: window.__twinBefore.some((v, i) => Math.abs(v - after[i]) > 1e-6),
                atlas: window.__app.params.e8ProjectionAuto,
                atlasMode: window.__app.params.e8ViewMode,
              };
              window.__app.toggleProjectionAuto();
              return result;
            }""")
            check("Twin 600 recolors clearly and Atlas advances immediately",
                  twin_atlas["twinEnabled"] is True and twin_atlas["twinCompareCleared"] is True
                  and twin_atlas["twin"] is False and twin_atlas["compareMode"] == "off"
                  and twin_atlas["recolored"] is True and twin_atlas["atlas"] is True
                  and twin_atlas["atlasMode"] != "coxeter", str(twin_atlas))

            # ---- 5. Adaptive DPR restores native on toggle-off ----
            restored = pg.evaluate("""() => {
              const r = window.__app.renderer; if (!r) return null;
              const native = Math.min(window.devicePixelRatio || 1, 2);
              r.setPixelRatio(0.8);                       // simulate a downscale
              if (!window.__app.params.adaptivePixelRatio) window.__app.toggleAdaptivePixelRatio(); // ensure on
              window.__app.toggleAdaptivePixelRatio();     // now off -> should restore
              return { dpr: r.getPixelRatio(), native };
            }""")
            check("adaptive DPR restores native on toggle-off",
                  restored is not None and abs(restored["dpr"] - restored["native"]) < 1e-6,
                  str(restored))

            # ---- Auto zoom control must activate; its complete bounded curve
            # is covered deterministically by test_state_modules.mjs. ----
            zoom_state = pg.evaluate("""() => {
              window.__app.resetCamera();
              window.__app.setParam('cameraPath', 'manual');
              window.__app.setParam('cameraMode', 'orbit');
              window.__app.setParam('showAmbient', false);
              window.__app.setParam('cameraOrbit', true);
              window.__app.setParam('cameraSpeed', 2);
              window.__app.setParam('autoZoom', true);
              return {
                enabled: window.__app.params.autoZoom,
                distance: window.__app.camera.position.length(),
              };
            }""")
            pg.evaluate("""() => {
              window.__app.setParam('autoZoom', false);
              window.__app.setParam('cameraOrbit', false);
            }""")
            check("auto zoom activates with a valid bounded camera distance",
                  bool(zoom_state["enabled"]) and 0.44 <= zoom_state["distance"] <= 12.01,
                  str(zoom_state))

            # ---- 6. Persisted actions actually update localStorage ----
            pg.evaluate("""() => {
              const key = 'e8_studio_config_v1';
              localStorage.removeItem(key);

              window.__app.setParam('e8Spin', 1.25);
              window.__app.setParam('e8Tilt', -1.5);
              window.__app.setParam('e8Roll', 2.75);
              window.__app.setParam('e8AutoRotate', true);
              return true;
            }""")
            pg.wait_for_timeout(400)
            pg.evaluate("() => window.__app.resetE8Angles()")
            pg.wait_for_timeout(400)
            e8_reset = pg.evaluate("""() => JSON.parse(localStorage.getItem('e8_studio_config_v1') || '{}')""")
            check("E8 angle reset persists",
                  e8_reset.get("e8Spin") == 0 and e8_reset.get("e8Tilt") == 0
                  and e8_reset.get("e8Roll") == 0 and e8_reset.get("e8AutoRotate") is False,
                  str(e8_reset))

            pg.evaluate("""() => {
              const key = 'e8_studio_config_v1';
              localStorage.removeItem(key);
              for (const k of ['polyRotXY','polyRotZW','polyRotXZ','polyRotYW','polyRotXW','polyRotYZ']) {
                window.__app.setParam(k, 1.2);
              }
              window.__app.setParam('polyAutoRotate', true);
            }""")
            pg.wait_for_timeout(400)
            pg.evaluate("() => window.__app.resetPolyAngles()")
            pg.wait_for_timeout(400)
            poly_reset = pg.evaluate("""() => JSON.parse(localStorage.getItem('e8_studio_config_v1') || '{}')""")
            check("4D angle reset persists",
                  all(poly_reset.get(k) == 0 for k in ['polyRotXY','polyRotZW','polyRotXZ','polyRotYW','polyRotXW','polyRotYZ'])
                  and poly_reset.get("polyAutoRotate") is False,
                  str(poly_reset))

            pg.evaluate("""() => {
              const key = 'e8_studio_config_v1';
              localStorage.removeItem(key);
              window.__app.params.weylOrbit = false;
              window.__app.params.weylOrbitFast = false;
              window.__app.toggleWeylOrbit();
              window.__app.toggleWeylFast();
            }""")
            pg.wait_for_timeout(400)
            weyl_store = pg.evaluate("""() => JSON.parse(localStorage.getItem('e8_studio_config_v1') || '{}')""")
            check("Weyl trail toggles persist",
                  weyl_store.get("weylOrbit") is True and weyl_store.get("weylOrbitFast") is True,
                  str(weyl_store))

            pg.evaluate("""() => {
              const key = 'e8_studio_config_v1';
              localStorage.removeItem(key);
              window.__app.setPreset('rainbow-flow');
            }""")
            pg.wait_for_timeout(400)
            preset_store = pg.evaluate("""() => JSON.parse(localStorage.getItem('e8_studio_config_v1') || '{}')""")
            check("preset action persists",
                  preset_store.get("palette") == "rainbow"
                  and preset_store.get("shiftMode") == "rainbow"
                  and preset_store.get("fxMode") == "glow"
                  and preset_store.get("autoRotate") is True,
                  str(preset_store))

            # ---- Asset export (OBJ 3D model + portable geometry JSON) ----
            obj = pg.evaluate("() => window.__app.getOBJ('cube')")
            check("OBJ export: cube = 8 verts / 12 tris",
                  bool(obj) and obj.count("\nv ") == 8 and obj.count("\nf ") == 12)
            # Morph-aware export: a twisted solid exports its deformed geometry.
            pg.evaluate("() => window.__app.setParam('shapeTwist', 1.0)")
            obj_m = pg.evaluate("() => window.__app.getOBJ('cube')")
            pg.evaluate("() => window.__app.setParam('shapeTwist', 0)")
            check("OBJ export is morph-aware", bool(obj_m) and "# morph:" in obj_m)
            gj = pg.evaluate("() => window.__app.getGeometryJSON()")
            check("geometry JSON export is well-formed",
                  bool(gj and gj.get("kind") and gj.get("view")), str(gj.get("kind") if gj else None))

            # ---- 7. Desktop fidelity and mobile safeguards use separate DPR budgets ----
            hidpi_context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                device_scale_factor=2,
            )
            hidpi = hidpi_context.new_page()
            hidpi.add_init_script("window.__forceSdfSafeMode = true")
            hidpi.goto(f"{base}/dist/index.html", wait_until="commit", timeout=20000)
            hidpi.wait_for_function("() => !!(window.__app && window.__app.renderer)", timeout=20000)
            hidpi_metrics = hidpi.evaluate("""() => {
              if (window.__app.params.adaptivePixelRatio) window.__app.toggleAdaptivePixelRatio();
              window.__app.switchView('e8coxeter');
              const pointDprs = [];
              const lineDprs = [];
              window.__app.currentView.object3d.traverse(object => {
                const material = object.material;
                const dpr = material?.uniforms?.uPixelRatio?.value;
                if (!Number.isFinite(dpr)) return;
                if (object.isPoints) pointDprs.push(dpr);
                if (object.isLine || object.isLineSegments || object.isLineLoop) lineDprs.push(dpr);
              });
              const buttons = Array.from(document.querySelectorAll('.ps-view-switch button'));
              const rootLab = buttons[buttons.length - 2];
              const dynkin = buttons[buttons.length - 1];
              return {
                native: window.devicePixelRatio,
                renderer: window.__app.renderer.getPixelRatio(),
                pointDprs,
                lineDprs,
                rootLabColumn: rootLab ? getComputedStyle(rootLab).gridColumnStart : null,
                dynkinColumn: dynkin ? getComputedStyle(dynkin).gridColumnStart : null,
              };
            }""")
            check("desktop high quality uses native 2x DPR",
                  abs(hidpi_metrics["native"] - 2) < 1e-6
                  and abs(hidpi_metrics["renderer"] - 2) < 1e-6,
                  str(hidpi_metrics))
            check("point and line shaders track actual renderer DPR",
                  bool(hidpi_metrics["pointDprs"] and hidpi_metrics["lineDprs"])
                  and all(abs(value - hidpi_metrics["renderer"]) < 1e-6
                          for value in hidpi_metrics["pointDprs"] + hidpi_metrics["lineDprs"]),
                  str(hidpi_metrics))
            check("Root Lab and Dynkin share a centered final model row",
                  hidpi_metrics["rootLabColumn"] == "2"
                  and hidpi_metrics["dynkinColumn"] == "4", str(hidpi_metrics))
            hidpi_context.close()

            touch_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=3,
                has_touch=True,
            )
            touch = touch_context.new_page()
            touch.add_init_script("window.__forceSdfSafeMode = true")
            touch.goto(f"{base}/dist/index.html", wait_until="commit", timeout=20000)
            touch.wait_for_function("() => !!(window.__app && window.__app.renderer)", timeout=20000)
            touch_metrics = touch.evaluate("""() => {
              if (window.__app.params.adaptivePixelRatio) window.__app.toggleAdaptivePixelRatio();
              return {
                native: window.devicePixelRatio,
                renderer: window.__app.renderer.getPixelRatio(),
                touchShell: document.body.classList.contains('desktop-touch-shell'),
              };
            }""")
            check("small touch shell keeps the mobile DPR ceiling",
                  touch_metrics["native"] == 3 and touch_metrics["touchShell"] is True
                  and touch_metrics["renderer"] <= 1.35 + 1e-6,
                  str(touch_metrics))
            touch_context.close()

            # No stray console errors during the whole clean-page run
            check("no console errors during run", len(console_errs) == 0,
                  f"{len(console_errs)} errors: {console_errs[:2]}")
            browser.close()
    finally:
        httpd.shutdown(); httpd.server_close()

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n{passed}/{len(results)} checks passed.")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
