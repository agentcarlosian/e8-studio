#!/usr/bin/env python3
"""Canonical local verification for E8 Platonics Studio."""
from __future__ import annotations

import ast
import html
import json
import os
import re
import socket
import subprocess
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUMMARY_DIR = ROOT / "dist" / "verify"
WEB_DIST = ROOT / "dist" / "web"
VIEWS = ["bloom", "platonic", "e8coxeter", "sixhundred", "polytope", "raymarched"]
SHAPES = ["tetrahedron", "cube", "octahedron", "dodecahedron", "icosahedron"]


def run(cmd: list[str], *, cwd: Path = ROOT) -> None:
    print("$ " + " ".join(cmd))
    subprocess.run(cmd, cwd=cwd, check=True)


def fail(message: str) -> None:
    raise AssertionError(message)


def check_build() -> None:
    run([sys.executable, "scripts/build.py"])


def check_web_build() -> None:
    vite_cli = ROOT / "node_modules" / "vite" / "bin" / "vite.js"
    if not vite_cli.exists():
        fail("Vite is not installed; run npm ci")
    run(["node", str(vite_cli), "build"])
    index = WEB_DIST / "index.html"
    if not index.exists():
        fail("Vite web build did not produce dist/web/index.html")
    built_html = index.read_text(encoding="utf-8")
    if 'type="importmap"' in built_html or "cdn.jsdelivr.net" in built_html:
        fail("Vite web build retained the legacy CDN import map or allowance")
    assets = WEB_DIST / "assets"
    if not any(assets.glob("*.js")) or not any(assets.glob("*.css")):
        fail("Vite web build is missing bundled JS or CSS assets")
    for name in ["e8", "e8_math", "platonic", "polytopes4d", "dynkin", "mckay", "mckay_subsets"]:
        if not (WEB_DIST / "data" / f"{name}.json").exists():
            fail(f"Vite web build is missing canonical data/{name}.json")


def check_js_syntax() -> None:
    for path in sorted((ROOT / "src").rglob("*.js")):
        run(["node", "--check", str(path)])


def check_lifecycle_contracts() -> None:
    run(["node", "scripts/test_state_modules.mjs"])
    run(["node", "scripts/test_resource_scope.mjs"])
    run(["node", "scripts/test_frame_health.mjs"])
    run(["node", "scripts/test_recording_recovery.mjs"])
    run(["node", "scripts/test_export_delivery.mjs"])
    run(["node", "scripts/test_image_export_recovery.mjs"])
    run(["node", "scripts/test_curriculum.mjs"])
    run(["node", "scripts/test_progress.mjs"])
    run(["node", "scripts/test_content_integrity.mjs"])


def check_python_syntax() -> None:
    for path in sorted((ROOT / "scripts").glob("*.py")):
        source = path.read_text(encoding="utf-8")
        compile(source, str(path), "exec", ast.PyCF_ONLY_AST)


def load_json(name: str):
    return json.loads((ROOT / "data" / f"{name}.json").read_text(encoding="utf-8"))


def check_data_invariants() -> None:
    run(["node", "scripts/generate_curriculum.mjs"])
    e8 = load_json("e8")
    if e8.get("count") != 240:
        fail("e8.count must be 240")
    roots = e8.get("roots8d", [])
    proj = e8.get("proj2d", [])
    if len(roots) != 240 or len(proj) != 240:
        fail("E8 roots8d and proj2d must each contain 240 entries")
    ring_counts = e8.get("ring_counts", [])
    ring_radii = e8.get("ring_radii", [])
    if ring_counts != [30] * 8 or len(ring_radii) != 8:
        fail("Canonical E8 Coxeter projection must have 8 rings of 30 roots")
    projected_points = {
        (round(float(p["x"]), 9), round(float(p["y"]), 9)) for p in proj
    }
    if len(projected_points) != 240:
        fail("Canonical E8 Coxeter projection must contain 240 distinct points")
    if any(len(r) != 8 for r in roots):
        fail("Every E8 root must be 8D")
    base_norm = sum(x * x for x in roots[0])
    for i, root in enumerate(roots):
        norm = sum(x * x for x in root)
        if abs(norm - base_norm) > 1e-9:
            fail(f"E8 root {i} has inconsistent norm")

    e8_math = load_json("e8_math")
    if e8_math.get("rank") != 8 or e8_math.get("dim") != 248:
        fail("e8_math rank/dim mismatch")
    if len(e8_math.get("petrie_cycle_30", [])) != 30:
        fail("petrie_cycle_30 must contain 30 root indices")
    if len(e8_math.get("simple_root_indices", [])) != 8:
        fail("simple_root_indices must contain 8 entries")
    cycle = e8_math["petrie_cycle_30"]
    if len(set(cycle)) != 30:
        fail("petrie_cycle_30 must contain 30 distinct roots")
    if {proj[i]["ring"] for i in cycle} != {7}:
        fail("petrie_cycle_30 must follow the outer canonical Coxeter orbit")
    for i, root_idx in enumerate(cycle):
        next_idx = cycle[(i + 1) % len(cycle)]
        distance_sq = sum((roots[root_idx][k] - roots[next_idx][k]) ** 2 for k in range(8))
        if abs(distance_sq - 2.0) > 1e-9:
            fail("petrie_cycle_30 must follow edges of the E8 root polytope")
    for simple, root_idx in zip(e8["simple_roots"], e8_math["simple_root_indices"]):
        if any(abs(a - b) > 1e-9 for a, b in zip(simple, roots[root_idx])):
            fail("simple_root_indices must resolve to the generated E8 simple roots")

    platonic = load_json("platonic")
    expected_platonic = {
        "tetrahedron": (4, 6),
        "cube": (8, 12),
        "octahedron": (6, 12),
        "dodecahedron": (20, 30),
        "icosahedron": (12, 30),
    }
    for name, (verts, edges) in expected_platonic.items():
        item = platonic.get(name)
        if not item or len(item.get("verts", [])) != verts or len(item.get("edges", [])) != edges:
            fail(f"Platonic data mismatch for {name}")
        if len(item.get("faces", [])) == 0:
            fail(f"Platonic data for {name} must include faces")

    polytopes = load_json("polytopes4d")
    expected_poly = {
        "5cell": (5, 10),
        "tesseract": (16, 32),
        "16cell": (8, 24),
        "24cell": (24, 96),   # 96 is correct (was 72 — codified a precompute bug)
        "600cell": (120, 720),
        "120cell": (600, 1200),  # dual of the 600-cell
    }
    for name, (verts, edges) in expected_poly.items():
        item = polytopes.get(name)
        if not item or len(item.get("verts", [])) != verts or len(item.get("edges", [])) != edges:
            fail(f"4D polytope data mismatch for {name}")

    dynkin = load_json("dynkin")
    if "E8" not in dynkin or len(dynkin["E8"].get("nodes", [])) != 8:
        fail("Dynkin data must include E8 with 8 nodes")

    mckay = load_json("mckay")
    subsets = load_json("mckay_subsets")
    for shape in SHAPES:
        if shape not in mckay:
            fail(f"mckay missing {shape}")
        if shape not in subsets or not isinstance(subsets[shape], list):
            fail(f"mckay_subsets missing list for {shape}")


def check_palette_registry() -> None:
    run(["node", "scripts/test_visual_system.mjs"])
    text = (ROOT / "src" / "ui" / "palettes.js").read_text(encoding="utf-8")
    preset_block = re.search(r"export const PALETTE_PRESETS = \{(.*?)\n\};", text, re.S)
    shift_block = re.search(r"export const SHIFT_PRESETS = \{(.*?)\n\};", text, re.S)
    if not preset_block or not shift_block:
        fail("Could not locate palette registries")
    palettes = set(re.findall(r"^\s*([A-Za-z0-9_]+):\s*\{", preset_block.group(1), re.M))
    shift_refs = re.findall(r"'([^']+)'", shift_block.group(1))
    missing = sorted({name for name in shift_refs if name not in palettes})
    if missing:
        fail("SHIFT_PRESETS references missing palettes: " + ", ".join(missing))


def find_chromium_executable() -> str | None:
    env = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
    if env and Path(env).exists():
        return env
    local = Path.home() / "AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe"
    if local.exists():
        return str(local)
    return None


def chromium_webgl_args() -> list[str]:
    """Use Chromium's deterministic software WebGL backend in headless tests."""
    return [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
    ]


def start_server() -> tuple[ThreadingHTTPServer, str]:
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    httpd = ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd, f"http://127.0.0.1:{port}"


def should_ignore_console(msg: str) -> bool:
    return "GPU stall due to ReadPixels" in msg


def assert_clean_browser_errors(page_errors: list[str], console_errors: list[str], label: str) -> None:
    if page_errors or console_errors:
        fail(f"{label} page errors={page_errors[:5]} console={console_errors[:5]}")


def check_browser_failure_helper() -> None:
    try:
        assert_clean_browser_errors(["injected page error"], [], "self-test")
    except AssertionError:
        return
    fail("Browser error helper did not fail on injected page error")


def assert_canvas_nonblank(page) -> None:
    sample = page.evaluate(
        """() => {
          const canvas = document.querySelector('canvas');
          if (!canvas || canvas.width < 2 || canvas.height < 2) return { ok:false, reason:'missing-canvas' };
          const copy = document.createElement('canvas');
          copy.width = Math.min(160, canvas.width);
          copy.height = Math.min(100, canvas.height);
          const ctx = copy.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(canvas, 0, 0, copy.width, copy.height);
          const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
          let lit = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] + data[i+1] + data[i+2] > 24 && data[i+3] > 0) lit++;
          }
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
          return {
            ok: lit > 25,
            lit,
            width: canvas.width,
            height: canvas.height,
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
            startup: window.__app?.startupMetrics || null,
            runtimeErrors: window.__app?.runtimeErrors?.slice(-3) || [],
          };
        }"""
    )
    if not sample.get("ok"):
        fail(f"Canvas appears blank: {sample}")


def open_checked_page(browser, url: str, *, label: str, viewport: dict[str, int] | None = None):
    resolved_viewport = viewport or {"width": 1400, "height": 900}
    page = browser.new_page(
        viewport=resolved_viewport,
        has_touch=resolved_viewport["width"] <= 760,
    )
    # CI renders through a software WebGL backend. Exercise the complete SDF
    # geometry with its low-cost shader tier so the smoke suite validates output
    # instead of benchmarking SwiftShader for several minutes.
    page.add_init_script("window.__forceSdfSafeMode = true")
    page_errors: list[str] = []
    console_errors: list[str] = []
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    def on_console(message):
        text = message.text
        if message.type == "error" and not should_ignore_console(text):
            console_errors.append(text)
        if "shader" in text.lower() and "error" in text.lower():
            console_errors.append(text)

    page.on("console", on_console)
    page.goto(url, timeout=30000, wait_until="commit")
    try:
        page.wait_for_function(
            """() => !!(
              window.__app
              && window.__app.params
              && window.__app.currentView
              && window.__app.startupMetrics?.firstFrameMs !== null
            )""",
            timeout=30000,
        )
    except Exception as exc:
        fail(f"{label} did not become ready: {exc}; page errors={page_errors[:5]} console={console_errors[:5]}")
    page.evaluate("document.getElementById('welcome-card')?.classList.add('hidden')")
    page.wait_for_timeout(250)
    assert_clean_browser_errors(page_errors, console_errors, label)
    assert_canvas_nonblank(page)
    return page, page_errors, console_errors


def assert_layout_accessibility(page, label: str, minimum_target: int = 24) -> None:
    metrics = page.evaluate(
        """() => {
          const visible = element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          };
          const canvas = document.getElementById('canvas')?.getBoundingClientRect();
          const panel = document.getElementById('panel')?.getBoundingClientRect();
          const controls = [...document.querySelectorAll('.tab, .panel-tab, .shape-pill')]
            .filter(visible).map(element => {
              const rect = element.getBoundingClientRect();
              return { width: rect.width, height: rect.height };
            });
          const focusTarget = [...document.querySelectorAll('button, input, select, a')].find(visible);
          focusTarget?.focus();
          const focusStyle = focusTarget ? getComputedStyle(focusTarget) : null;
          return {
            viewport: { width: innerWidth, height: innerHeight },
            bodyWidth: document.body.scrollWidth,
            canvas: canvas && { width: canvas.width, height: canvas.height, left: canvas.left, right: canvas.right },
            panel: panel && { width: panel.width, left: panel.left, right: panel.right },
            controls,
            focus: focusStyle && { width: parseFloat(focusStyle.outlineWidth), style: focusStyle.outlineStyle },
          };
        }"""
    )
    if not metrics["canvas"] or metrics["canvas"]["width"] < 200 or metrics["canvas"]["height"] < 200:
        fail(f"{label} canvas layout is unusable: {metrics}")
    if metrics["bodyWidth"] > metrics["viewport"]["width"] + 2:
        fail(f"{label} has horizontal document overflow: {metrics}")
    if not metrics["focus"] or metrics["focus"]["style"] == "none" or metrics["focus"]["width"] < 2:
        fail(f"{label} visible control lacks a focus ring: {metrics}")
    too_small = [item for item in metrics["controls"] if item["height"] < minimum_target]
    if too_small:
        fail(f"{label} has undersized primary controls (<{minimum_target}px): {too_small[:5]}")


def capture_visual_evidence(page, name: str) -> None:
    SUMMARY_DIR.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SUMMARY_DIR / f"{name}.png"), full_page=False)


def smoke_dev(browser, base_url: str, *, viewport: dict[str, int] | None = None, label: str = "dev") -> None:
    page, page_errors, console_errors = open_checked_page(browser, base_url + "/index.html", label=label, viewport=viewport)
    assert_layout_accessibility(page, label, 24)
    capture_visual_evidence(page, "desktop-1400x900")
    for view in VIEWS:
        page.evaluate("(view) => window.__app.switchView(view)", view)
        page.wait_for_timeout(900)
        state = page.evaluate("() => ({ view: window.__app.params.view, name: window.__app.currentView?.name })")
        if state["view"] != view:
            fail(f"View switch failed for {view}: {state}")
        assert_canvas_nonblank(page)

    # Repeated transitions catch resource/material accumulation and ensure the
    # frame circuit breaker is reset for each newly-created view instance.
    before_errors = page.evaluate("window.__app.runtimeErrors.length")
    for _cycle in range(2):
        for view in VIEWS:
            page.evaluate("(view) => window.__app.switchView(view)", view)
            page.wait_for_timeout(120)
    stress_state = page.evaluate(
        """() => ({
          view: window.__app.params.view,
          health: window.__app.frameHealth,
          resources: window.__app.activeResourceCount,
          errors: window.__app.runtimeErrors.length,
          fxMaterials: window.__app.fxRuntime?.fxMaterials?.size ?? 0,
        })"""
    )
    if stress_state["health"]["tripped"] or stress_state["health"]["viewId"] != stress_state["view"]:
        fail(f"Frame health did not settle after view-switch stress: {stress_state}")
    if stress_state["errors"] != before_errors:
        fail(f"Runtime errors increased during view-switch stress: {before_errors} -> {stress_state}")
    if stress_state["resources"] < 0 or stress_state["fxMaterials"] > 200:
        fail(f"Resource counts did not settle after view-switch stress: {stress_state}")

    page.evaluate(
        """() => {
          window.__app.switchView('e8coxeter');
          window.__app.params.e8ViewMode = 'coxeter';
          window.__app.params.autoRotate = false;
          window.__app.params.showAmbient = false;
        }"""
    )
    page.mouse.move(700, 450)
    page.mouse.click(700, 450)
    page.wait_for_timeout(500)

    # Start from a palette outside the sunset cycle and use the public setter,
    # which resets the cycle clock. The old direct param write could land on a
    # cycle position already matching the current palette and flake in CI.
    page.evaluate("""() => {
      window.__app.setPalette('mono');
      window.__app.setParam('shiftSpeed', 4);
      window.__app.setShiftMode('sunset');
    }""")
    try:
        page.wait_for_function("() => window.__app.params.palette !== 'mono'", timeout=3000)
    except Exception as exc:
        fail(f"Color shift did not change palette: {exc}")
    page.evaluate("window.__app.setShiftMode('static')")

    try:
        export_contracts = page.evaluate(
            """() => {
          const svg = window.__app.getE8Svg();
          const obj = window.__app.getOBJ('cube');
          window.__app.switchView('e8coxeter');
          const geometry = window.__app.getGeometryJSON();
          const postcard = window.__app.getPostcardPreviewInfo();
          const png = window.__app.renderer.domElement.toDataURL('image/png');
          return {
            svgStart: svg?.slice(0, 100),
            svgHasClosingTag: svg?.trim().endsWith('</svg>'),
            objVertices: obj?.split('\\n').filter(line => line.startsWith('v ')).length,
            objFaces: obj?.split('\\n').filter(line => line.startsWith('f ')).length,
            geometryKind: geometry?.kind,
            geometryDimension: geometry?.dimension,
            geometryCount: geometry?.roots8d?.length,
            postcard,
            pngPrefix: png?.slice(0, 22),
          };
            }"""
        )
    except Exception as exc:
        fail(f"Export contract script failed: {exc}")
    if not export_contracts["svgStart"].lstrip().startswith("<svg") or not export_contracts["svgHasClosingTag"]:
        fail(f"SVG export contract failed: {export_contracts}")
    if export_contracts["objVertices"] != 8 or not export_contracts["objFaces"]:
        fail(f"OBJ export contract failed: {export_contracts}")
    if (export_contracts["geometryKind"] != "e8-root-system"
            or export_contracts["geometryDimension"] != 8
            or export_contracts["geometryCount"] != 240):
        fail(f"Geometry JSON export contract failed: {export_contracts}")
    if export_contracts["postcard"] != {"width": 1080, "height": 1920}:
        fail(f"Postcard export contract failed: {export_contracts}")
    if export_contracts["pngPrefix"] != "data:image/png;base64,":
        fail(f"PNG export contract failed: {export_contracts}")

    try:
        quality_background = page.evaluate(
            """() => {
          window.__app.setMobileQuality('low');
          window.__app.setBgMode('quantum');
          const low = { quality: window.__app.params.mobileQuality, mode: window.__app.params.bgMode };
          window.__app.setMobileQuality('high');
          window.__app.setBgMode('quantum');
          const high = { quality: window.__app.params.mobileQuality, mode: window.__app.params.bgMode };
          window.__app.setBgMode('void');
          return { low, high };
            }"""
        )
    except Exception as exc:
        fail(f"Background quality script failed: {exc}")
    if quality_background != {
        "low": {"quality": "low", "mode": "void"},
        "high": {"quality": "high", "mode": "quantum"},
    }:
        fail(f"Background quality policy failed: {quality_background}")

    page.evaluate("window.__app.switchView('raymarched')")
    removed_sdf_effects = page.evaluate("""() => {
      const material = window.__app.currentView.object3d.material;
      return {
        acesButton: document.querySelectorAll('[data-act="toggleSDFToneMap"]').length,
        shadowButton: document.querySelectorAll('[data-act="toggleSDFColoredShadow"]').length,
        toneUniform: Object.hasOwn(material.uniforms, 'uToneMap'),
        shadowUniform: Object.hasOwn(material.uniforms, 'uColoredShadow'),
      };
    }""")
    if removed_sdf_effects != {"acesButton": 0, "shadowButton": 0, "toneUniform": False, "shadowUniform": False}:
        fail(f"Removed SDF effect contract failed: {removed_sdf_effects}")
    sdf_quality = page.evaluate("""() => {
      const before = window.__app.currentView.object3d.material;
      const initial = { ...before.userData.sdfQuality };
      window.__app.setMobileQuality('low');
      const lowMaterial = window.__app.currentView.object3d.material;
      const low = { ...lowMaterial.userData.sdfQuality };
      window.__app.setMobileQuality('high');
      const restoredMaterial = window.__app.currentView.object3d.material;
      const restored = { ...restoredMaterial.userData.sdfQuality };
      return {
        initial,
        low,
        restored,
        qualityButtons: document.querySelectorAll('[data-act="setMobileQuality"]').length,
        rebuiltForLow: before.uuid !== lowMaterial.uuid,
        rebuiltForRestore: lowMaterial.uuid !== restoredMaterial.uuid,
      };
    }""")
    for name in ["initial", "low", "restored"]:
        profile = sdf_quality[name]
        if (profile["ringCount"] != 8
                or profile["representedRoots"] != 240
                or profile["sampledRootsPerSdf"] > 40):
            fail(f"SDF compact-ring quality contract failed: {sdf_quality}")
    if (sdf_quality["low"]["tier"] != "low"
            or sdf_quality["low"]["sampledRootsPerSdf"] != 8):
        fail(f"SDF low-quality budget failed: {sdf_quality}")
    if not sdf_quality["rebuiltForLow"] or not sdf_quality["rebuiltForRestore"]:
        fail(f"SDF quality change did not rebuild the fixed-budget shader: {sdf_quality}")
    if sdf_quality["qualityButtons"] != 3:
        fail(f"SDF quality controls are not available in the panel: {sdf_quality}")

    sdf_environment_contract = page.evaluate("""async () => {
      const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
      const sampleCorners = () => {
        const canvas = document.querySelector('canvas');
        const copy = document.createElement('canvas');
        copy.width = 120;
        copy.height = 80;
        const ctx = copy.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(canvas, 0, 0, copy.width, copy.height);
        const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
        const points = [[6, 6], [114, 6], [6, 74], [114, 74]];
        return points.map(([x, y]) => {
          const i = (y * copy.width + x) * 4;
          return [data[i], data[i + 1], data[i + 2]];
        });
      };
      window.__app.setMobileQuality('high');
      window.__app.setParam('showAmbient', false);
      window.__app.setBgMode('void');
      await frame(); await frame();
      const voidCorners = sampleCorners();
      const result = {};
      for (const mode of ['starfield', 'aurora', 'eclipse', 'synthwave', 'prism', 'vortex']) {
        window.__app.setBgMode(mode);
        await frame(); await frame();
        result[mode] = {
          selected: window.__app.params.bgMode,
          mesh: window.__app.scene.getObjectByName(`bg-${mode}`)?.name || '',
          corners: sampleCorners(),
        };
      }
      window.__app.setBgMode('void');
      return { transparent: window.__app.currentView.object3d.material.transparent, voidCorners, result };
    }""")
    if not sdf_environment_contract["transparent"]:
        fail(f"SDF must leave missed rays transparent for environments: {sdf_environment_contract}")
    for mode, environment in sdf_environment_contract["result"].items():
        if environment["selected"] != mode or environment["mesh"] != f"bg-{mode}":
            fail(f"SDF environment selection did not activate {mode}: {sdf_environment_contract}")
        if environment["corners"] == sdf_environment_contract["voidCorners"]:
            fail(f"SDF environment {mode} did not alter visible background pixels: {sdf_environment_contract}")

    sdf_effect_contract = page.evaluate("""async () => {
      const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
      window.__app.setParam('showAmbient', false);
      window.__app.setBgMode('void');
      window.__app.setParam('fxIntensity', 1);
      window.__app.setFX('glow');
      await frame();
      const material = window.__app.currentView.object3d.material;
      const createWorkspace = {
        tabs: document.querySelectorAll('.ps-mode-tabs button').length,
        viewSections: document.querySelectorAll('[data-section="view"]').length,
        learnSections: document.querySelectorAll('[data-section="learn"]').length,
      };
      window.__app.setPanelMode('learn');
      const learnWorkspace = {
        viewSections: document.querySelectorAll('[data-section="view"]').length,
        learnSections: document.querySelectorAll('[data-section="learn"]').length,
      };
      window.__app.setPanelMode('create');
      const basicModes = [...document.querySelectorAll('.look-card[data-act="setFX"]')]
        .map(button => button.dataset.arg);
      window.__app.toggleAdvancedStyle();
      const catalogModes = [...document.querySelectorAll('.fx-catalog-item[data-act="setFX"]')]
        .map(button => button.dataset.arg);
      const catalogDisabled = [...document.querySelectorAll('.fx-catalog-item:disabled')]
        .map(button => button.dataset.arg);

      // Freeze view uniforms so a pixel delta can only come from changing the
      // selected effect, not camera drift or the SDF's ambient animation.
      window.__app.params.paused = true;
      await frame();
      const sample = () => {
        const canvas = document.querySelector('canvas');
        const copy = document.createElement('canvas');
        copy.width = 96;
        copy.height = 60;
        const ctx = copy.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(canvas, 0, 0, copy.width, copy.height);
        return ctx.getImageData(0, 0, copy.width, copy.height).data;
      };
      window.__app.setFX('none');
      await frame(); await frame();
      const baseline = sample();
      const pixelCount = baseline.length / 4;
      const visualDiffs = {};
      const uniformModes = {};
      for (const mode of ['glow', 'pulse', 'heat', 'iridescent', 'hologram', 'xray']) {
        window.__app.setFX(mode);
        await frame(); await frame();
        const pixels = sample();
        let total = 0;
        let changed = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const delta = Math.abs(pixels[i] - baseline[i])
            + Math.abs(pixels[i + 1] - baseline[i + 1])
            + Math.abs(pixels[i + 2] - baseline[i + 2]);
          total += delta;
          if (delta >= 12) changed++;
        }
        visualDiffs[mode] = {
          meanRgbDelta: total / pixelCount / 3,
          changed,
        };
        uniformModes[mode] = material.uniforms.uFXMode.value;
      }
      window.__app.params.paused = false;

      // Each renderer remembers its own compatible choice.
      window.__app.setFX('glow');
      window.__app.switchView('e8coxeter');
      window.__app.setFX('plasma');
      window.__app.switchView('raymarched');
      const restoredSdf = window.__app.params.fxMode;
      window.__app.switchView('e8coxeter');
      const restoredPoints = window.__app.params.fxMode;
      window.__app.switchView('raymarched');
      return {
        hasModeUniform: Object.hasOwn(material.uniforms, 'uFXMode'),
        hasIntensityUniform: Object.hasOwn(material.uniforms, 'uFXIntensity'),
        trackedMaterials: window.__app.fxRuntime.fxMaterials.size,
        materialModes: material.userData.effectModes,
        basicModes,
        catalogModes,
        catalogDisabled,
        visualDiffs,
        uniformModes,
        restoredSdf,
        restoredPoints,
        createWorkspace,
        learnWorkspace,
      };
    }""")
    expected_sdf_modes = ["none", "glow", "pulse", "heat", "iridescent", "hologram", "xray"]
    expected_basic_modes = ["none", "glow", "iridescent", "pulse", "xray", "hologram"]
    if (not sdf_effect_contract["hasModeUniform"]
            or not sdf_effect_contract["hasIntensityUniform"]
            or sdf_effect_contract["trackedMaterials"] != 1
            or sdf_effect_contract["materialModes"] != expected_sdf_modes
            or sdf_effect_contract["basicModes"] != expected_basic_modes
            or sdf_effect_contract["catalogModes"] != expected_sdf_modes
            or sdf_effect_contract["catalogDisabled"]):
        fail(f"SDF effect capability/UI contract failed: {sdf_effect_contract}")
    if (sdf_effect_contract["createWorkspace"] != {"tabs": 2, "viewSections": 1, "learnSections": 0}
            or sdf_effect_contract["learnWorkspace"] != {"viewSections": 0, "learnSections": 1}):
        fail(f"Create/Learn workspace contract failed: {sdf_effect_contract}")
    if sdf_effect_contract["restoredSdf"] != "glow" or sdf_effect_contract["restoredPoints"] != "plasma":
        fail(f"Per-view effect memory failed: {sdf_effect_contract}")
    for mode, visual in sdf_effect_contract["visualDiffs"].items():
        if visual["meanRgbDelta"] < 0.35 or visual["changed"] < 20:
            fail(f"SDF effect {mode} did not visibly change pixels: {sdf_effect_contract}")
    page.evaluate("window.__app.switchView('e8coxeter')")
    page.wait_for_timeout(300)

    share_contract = page.evaluate("""() => ({
      pageButtons: document.querySelectorAll('[data-act="sharePage"]').length,
      snapshotButtons: document.querySelectorAll('[data-act="shareSnapshot"]').length,
      url: window.__app.sharePage(),
    })""")
    expected_share_url = page.url.split('#', 1)[0].split('?', 1)[0]
    if share_contract != {"pageButtons": 1, "snapshotButtons": 1, "url": expected_share_url}:
        fail(f"Hosted share/snapshot contract failed: {share_contract}")

    learning_open_ms = page.evaluate("""() => {
      const started = performance.now();
      window.__app.openLearningCenter();
      return performance.now() - started;
    }""")
    if learning_open_ms > 500:
        fail(f"Learning Center open performance budget exceeded: {learning_open_ms:.1f}ms > 500ms")
    page.wait_for_selector(".learning-center-dialog", timeout=5000)
    capture_visual_evidence(page, "learning-center-desktop")
    learning_center = page.evaluate(
        """() => ({
          paths: document.querySelectorAll('.learning-path').length,
          lessons: document.querySelectorAll('[data-learning-lesson]').length,
          title: document.querySelector('.learning-center-content h2')?.textContent,
          sources: document.querySelectorAll('.learning-source-card').length,
          claim: document.querySelector('.learning-claim-note strong')?.textContent,
        })"""
    )
    if learning_center["paths"] != 4 or learning_center["lessons"] < 8 or learning_center["title"] != "Why only five?" or learning_center["sources"] < 1 or learning_center["claim"] != "Established mathematics":
        fail(f"Learning Center initial curriculum failed: {learning_center}")
    lesson_navigation_ms = page.evaluate("""() => {
      const started = performance.now();
      document.querySelector('[data-learning-lesson="mckay-bridge"]')?.click();
      return performance.now() - started;
    }""")
    if lesson_navigation_ms > 250:
        fail(f"Learning Center navigation performance budget exceeded: {lesson_navigation_ms:.1f}ms > 250ms")
    mckay_lesson = page.evaluate(
        """() => ({
          title: document.querySelector('.learning-center-content h2')?.textContent,
          sources: document.querySelectorAll('.learning-source-card').length,
          readings: document.querySelectorAll('[data-learning-essay]').length,
          current: document.querySelector('.learning-lesson-link[aria-current="step"]')?.dataset.learningLesson,
          claim: document.querySelector('.learning-claim-note strong')?.textContent,
        })"""
    )
    if mckay_lesson != {"title": "McKay correspondence", "sources": 2, "readings": 2, "current": "mckay-bridge", "claim": "Interpretation"}:
        fail(f"Learning Center lesson navigation failed: {mckay_lesson}")
    page.click('[data-learning-complete="mckay-bridge"]')
    completed_lesson = page.evaluate(
        """() => ({
          stored: !!window.__app.progress.lessons?.['mckay-bridge'],
          label: document.querySelector('.learning-lesson-link[aria-current="step"] small')?.textContent,
          pressed: document.querySelector('[data-learning-complete="mckay-bridge"]')?.getAttribute('aria-pressed'),
        })"""
    )
    if completed_lesson != {"stored": True, "label": "complete", "pressed": "true"}:
        fail(f"Learning Center completion persistence failed: {completed_lesson}")
    page.click('[data-learning-essay="e8_mckay"]')
    page.wait_for_selector('.essay-provenance[data-claim-type="interpretation"]', timeout=5000)
    essay_provenance = page.evaluate("""() => ({
      label: document.querySelector('.essay-provenance strong')?.textContent,
      sources: document.querySelectorAll('.essay-provenance a').length,
      body: document.querySelector('.essay-provenance')?.textContent,
    })""")
    if essay_provenance["label"] != "Interpretation" or essay_provenance["sources"] != 2 or "not its construction" not in essay_provenance["body"]:
        fail(f"Essay claim provenance failed: {essay_provenance}")
    page.evaluate("window.__app.openLearningCenter('mckay-bridge')")
    page.wait_for_selector('.learning-center-dialog', timeout=5000)
    page.click('[data-learning-open-view="e8coxeter"]')
    page.wait_for_timeout(300)
    if page.evaluate("window.__app.params.view") != "e8coxeter":
        fail("Learning Center visualization action did not activate E8 view")
    page.keyboard.press("l")
    page.wait_for_selector(".learning-center-dialog", timeout=5000)
    page.click('[data-modal-close]')

    exercise_gallery_reset(page, page_errors, console_errors, f"{label}-gallery-reset")
    context_loss = page.evaluate(
        """() => {
          const canvas = window.__app.renderer.domElement;
          const event = new Event('webglcontextlost', { cancelable: true });
          canvas.dispatchEvent(event);
          return {
            prevented: event.defaultPrevented,
            reducedMode: window.__app.params.reducedMode,
            quality: window.__app.params.mobileQuality,
            fallbackVisible: !document.getElementById('render-fallback')?.classList.contains('hidden'),
          };
        }"""
    )
    if context_loss != {"prevented": True, "reducedMode": True, "quality": "low", "fallbackVisible": True}:
        fail(f"WebGL context-loss recovery contract failed: {context_loss}")
    assert_clean_browser_errors(page_errors, console_errors, label)
    page.close()


def smoke_mobile(browser, base_url: str) -> None:
    page, page_errors, console_errors = open_checked_page(
        browser,
        base_url + "/index.html",
        label="dev-mobile",
        viewport={"width": 390, "height": 844},
    )
    assert_layout_accessibility(page, "dev-mobile", 40)
    capture_visual_evidence(page, "phone-390x844")
    page.evaluate("window.__app.switchView('e8coxeter')")
    page.wait_for_timeout(800)
    assert_canvas_nonblank(page)
    page.evaluate("window.__app.toggleCommandPalette()")
    page.wait_for_selector("[data-cmd-search]", timeout=5000)
    page.keyboard.type("svg")
    page.keyboard.press("Escape")
    page.evaluate("window.__app.togglePerf(); window.__app.togglePerf()")
    page.wait_for_timeout(300)
    assert_clean_browser_errors(page_errors, console_errors, "dev-mobile")
    page.close()


def exercise_weyl_chamber(page, page_errors: list[str], console_errors: list[str], label: str) -> None:
    page.evaluate("window.__app.applyGalleryPreset && window.__app.applyGalleryPreset('weyl-chamber')")
    page.wait_for_timeout(1800)
    assert_canvas_nonblank(page)
    state = page.evaluate("() => ({ view: window.__app.params.view, orbit: !!window.__app.params.weylOrbit })")
    if state.get("view") != "e8coxeter" or not state.get("orbit"):
        fail(f"{label} Weyl Chamber preset did not activate: {state}")
    assert_clean_browser_errors(page_errors, console_errors, label)


def exercise_gallery_reset(page, page_errors: list[str], console_errors: list[str], label: str) -> None:
    for preset in ["twin-600", "weyl-chamber", "subset-diff", "coxeter-rings"]:
        page.evaluate("(id) => window.__app.applyGalleryPreset(id)", preset)
        page.wait_for_timeout(450)
        assert_canvas_nonblank(page)
    state = page.evaluate(
        """() => ({
          galleryPreset: window.__app.params.galleryPreset,
          view: window.__app.params.view,
          e8ViewMode: window.__app.params.e8ViewMode,
          e8Twin600: window.__app.params.e8Twin600,
          rootHaloDepth: window.__app.params.rootHaloDepth,
          rootDiffusionSpeed: window.__app.params.rootDiffusionSpeed,
          weylOrbit: window.__app.params.weylOrbit,
          showWeylMirrors: window.__app.params.showWeylMirrors,
          showPetrie: window.__app.params.showPetrie,
          showEdges: window.__app.params.showEdges,
          cameraPath: window.__app.params.cameraPath,
        })"""
    )
    expected = {
        "galleryPreset": "coxeter-rings",
        "view": "e8coxeter",
        "e8ViewMode": "coxeter",
        "e8Twin600": False,
        "rootHaloDepth": 3,
        "weylOrbit": False,
        "showWeylMirrors": True,
        "showPetrie": True,
        "showEdges": False,
        "cameraPath": "coxeterOrbit",
    }
    for key, value in expected.items():
        if state.get(key) != value:
            fail(f"{label} leaked gallery state for {key}: expected {value!r}, got {state.get(key)!r}; state={state}")
    if abs(state.get("rootDiffusionSpeed", 0) - 1.25) > 1e-9:
        fail(f"{label} leaked rootDiffusionSpeed: {state}")
    assert_clean_browser_errors(page_errors, console_errors, label)


def smoke_browser() -> None:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        # Provide actionable guidance — multiple Python installs on the
        # system mean `python` on PATH often points at a venv without
        # playwright. (See the verification note in README.md.)
        sys_exe = sys.executable
        msg = (
            f"Playwright is required for browser smoke tests: {exc}\n"
            f"  Current Python: {sys_exe}\n"
            f"  Fix:\n"
            f"    pip install playwright\n"
            f"    python -m playwright install chromium\n"
            f"  Or run verifier from a Python that has playwright installed."
        )
        fail(msg)

    httpd, base_url = start_server()
    executable = find_chromium_executable()
    try:
        with sync_playwright() as p:
            launch_args = {"headless": True, "args": chromium_webgl_args()}
            if executable:
                launch_args["executable_path"] = executable
            browser = p.chromium.launch(**launch_args)
            try:
                smoke_dev(browser, base_url)
                tablet, tablet_page_errors, tablet_console_errors = open_checked_page(
                    browser, base_url + "/index.html", label="dev-tablet", viewport={"width": 900, "height": 800}
                )
                assert_layout_accessibility(tablet, "dev-tablet", 24)
                capture_visual_evidence(tablet, "tablet-900x800")
                assert_clean_browser_errors(tablet_page_errors, tablet_console_errors, "dev-tablet")
                tablet.close()
                smoke_mobile(browser, base_url)
                page, page_errors, console_errors = open_checked_page(browser, base_url + "/dist/index.html", label="dist-http")
                exercise_weyl_chamber(page, page_errors, console_errors, "dist-http-weyl")
                exercise_gallery_reset(page, page_errors, console_errors, "dist-http-gallery-reset")
                page.close()
                page, page_errors, console_errors = open_checked_page(
                    browser, base_url + "/dist/web/index.html", label="web-dist-http"
                )
                exercise_weyl_chamber(page, page_errors, console_errors, "web-dist-http-weyl")
                exercise_gallery_reset(page, page_errors, console_errors, "web-dist-http-gallery-reset")
                page.close()
                file_url = (ROOT / "dist" / "index.html").resolve().as_uri()
                page, page_errors, console_errors = open_checked_page(browser, file_url, label="dist-file")
                exercise_weyl_chamber(page, page_errors, console_errors, "dist-file-weyl")
                page.close()
            finally:
                browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()


def write_summary(results: list[dict[str, object]]) -> None:
    SUMMARY_DIR.mkdir(parents=True, exist_ok=True)
    json_path = SUMMARY_DIR / "summary.json"
    html_path = SUMMARY_DIR / "summary.html"
    ok = all(item["status"] == "passed" for item in results)
    payload = {
        "ok": ok,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "results": results,
    }
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    rows = "\n".join(
        "<tr>"
        f"<td>{html.escape(str(item['name']))}</td>"
        f"<td class=\"{item['status']}\">{html.escape(str(item['status']))}</td>"
        f"<td>{item['seconds']:.2f}s</td>"
        f"<td>{html.escape(str(item.get('message', '')))}</td>"
        "</tr>"
        for item in results
    )
    html_path.write_text(
        f"""<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>E8 Studio Verification Summary</title>
<style>
body{{font-family:system-ui,sans-serif;background:#07070c;color:#f4f1ea;margin:32px}}
table{{border-collapse:collapse;width:100%;max-width:960px}}
td,th{{border:1px solid #2a2a3a;padding:8px;text-align:left}}
.passed{{color:#7df9c8}}.failed{{color:#ff9550}}
</style>
<h1>Verification {"Passed" if ok else "Failed"}</h1>
<p>{html.escape(payload["generatedAt"])}</p>
<table><thead><tr><th>Check</th><th>Status</th><th>Time</th><th>Message</th></tr></thead><tbody>{rows}</tbody></table>
</html>
""",
        encoding="utf-8",
    )
    print(f"Summary: {json_path}")
    print(f"Report:  {html_path}")


def main() -> int:
    checks = [
        ("build", check_build),
        ("web build", check_web_build),
        ("js syntax", check_js_syntax),
        ("lifecycle contracts", check_lifecycle_contracts),
        ("python syntax", check_python_syntax),
        ("data invariants", check_data_invariants),
        ("palette registry", check_palette_registry),
        ("browser helper self-test", check_browser_failure_helper),
        ("browser smoke", smoke_browser),
    ]
    results: list[dict[str, object]] = []
    for name, fn in checks:
        print(f"\n== {name} ==")
        started = time.perf_counter()
        try:
            fn()
        except Exception as exc:
            results.append({
                "name": name,
                "status": "failed",
                "seconds": time.perf_counter() - started,
                "message": str(exc),
            })
            write_summary(results)
            print(f"\nVERIFY FAILED: {exc}", file=sys.stderr)
            return 1
        results.append({
            "name": name,
            "status": "passed",
            "seconds": time.perf_counter() - started,
            "message": "",
        })
    write_summary(results)
    print("\nAll verification checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
