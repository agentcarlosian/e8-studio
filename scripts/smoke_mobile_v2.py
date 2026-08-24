#!/usr/bin/env python3
"""Smoke test the Android-first Mobile V2 shell."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from verify import start_server, find_chromium_executable  # noqa: E402


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}{(' -- ' + detail) if detail and not ok else ''}")
    if not ok:
        raise AssertionError(f"{name}: {detail}")


def main() -> int:
    print("Building mobile dist...")
    subprocess.run([sys.executable, str(ROOT / "scripts" / "build_mobile.py")], check=True)

    from playwright.sync_api import sync_playwright

    httpd, base = start_server()
    exe = find_chromium_executable()
    try:
        with sync_playwright() as p:
            launch = {
                "headless": True,
                "args": ["--no-sandbox"],
            }
            if exe:
                launch["executable_path"] = exe
            browser = p.chromium.launch(**launch)
            context = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
                device_scale_factor=3,
            )
            page = context.new_page()
            console_errs: list[str] = []
            page.on("console", lambda m: console_errs.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console_errs.append(str(e)))
            page.goto(f"{base}/dist/index.html", wait_until="commit", timeout=20000)
            page.wait_for_function("() => !!window.__mobileApp && window.__mobileApp.getMetrics().firstRenderMs !== null", timeout=10000)

            state = page.evaluate("() => window.__mobileApp.getState()")
            metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("mobile entrypoint exposes __mobileApp", bool(state), str(state))
            check("first render completes", 0 <= metrics["firstRenderMs"] < 1000, str(metrics))
            check("default quality is Smooth", state["quality"] == "smooth", str(state))
            check("canvas has mobile-sized backing store", metrics["canvas"]["width"] > 0 and metrics["canvas"]["height"] > 0, str(metrics))
            initial_draw = metrics["lastDrawStats"]
            check("initial draw renders all roots", initial_draw["points"] == 240 and initial_draw["rings"] == 8, str(initial_draw))
            check("E8 defaults to the full desktop chord topology", state["showEdges"] and initial_draw["e8ChordEdges"] == 21840 and initial_draw["e8ChordEdgeStrokes"] == 2 and initial_draw["e8ChordClassCount"] == 2 and initial_draw["e8ChordClassCounts"] == [0, 0, 0, 6720, 0, 0, 0, 15120] and metrics["e8ChordEdgeCount"] == 21840 and metrics["e8ChordDegreeMin"] == 182 and metrics["e8ChordDegreeMax"] == 182, str({"state": state, "draw": initial_draw, "metrics": metrics}))
            chord_layer = page.evaluate("""() => {
                const chord = document.getElementById('mobile-e8-chord-canvas');
                const roots = document.getElementById('mobile-canvas');
                return {
                    exists: !!chord,
                    active: chord?.classList.contains('active') || false,
                    composited: chord?.classList.contains('fx-composited') || false,
                    chordZ: Number(getComputedStyle(chord).zIndex),
                    rootZ: Number(getComputedStyle(roots).zIndex),
                    width: chord?.width || 0,
                    height: chord?.height || 0,
                };
            }""")
            check("E8 chords render through the dedicated GPU layer", initial_draw["e8ChordRenderer"] == "webgl-lines" and initial_draw["e8ChordGpuDrawCalls"] == 1 and initial_draw["e8ChordGpuVertices"] == 43680 and metrics["e8ChordWebglInitCount"] == 1 and metrics["e8ChordWebglFallbackCount"] == 0 and chord_layer["exists"] and chord_layer["active"] and not chord_layer["composited"] and chord_layer["chordZ"] < chord_layer["rootZ"] and chord_layer["width"] == metrics["canvas"]["width"] and chord_layer["height"] == metrics["canvas"]["height"], str({"draw": initial_draw, "metrics": metrics, "layer": chord_layer}))
            context_loss_supported = page.evaluate("""() => {
                const chord = document.getElementById('mobile-e8-chord-canvas');
                window.__mobileChordContextTest = chord.getContext('webgl').getExtension('WEBGL_lose_context');
                return !!window.__mobileChordContextTest;
            }""")
            check("GPU chord context-loss testing is available", context_loss_supported)
            page.evaluate("() => window.__mobileChordContextTest.loseContext()")
            page.wait_for_timeout(180)
            page.evaluate("() => window.__mobileApp.forceRender()")
            chord_context_lost = page.evaluate("() => ({ metrics: window.__mobileApp.getMetrics(), draw: window.__mobileApp.getMetrics().lastDrawStats })")
            check("WebGL context loss preserves all chords through Canvas fallback", chord_context_lost["metrics"]["e8ChordWebglContextLossCount"] == 1 and chord_context_lost["draw"]["e8ChordRenderer"] == "canvas-fallback" and chord_context_lost["draw"]["e8ChordEdges"] == 21840, str(chord_context_lost))
            page.evaluate("() => window.__mobileChordContextTest.restoreContext()")
            page.wait_for_timeout(300)
            page.evaluate("() => window.__mobileApp.forceRender()")
            chord_context_restored = page.evaluate("() => ({ metrics: window.__mobileApp.getMetrics(), draw: window.__mobileApp.getMetrics().lastDrawStats })")
            check("WebGL context restoration returns to the GPU chord layer", chord_context_restored["metrics"]["e8ChordWebglContextRestoreCount"] == 1 and chord_context_restored["draw"]["e8ChordRenderer"] == "webgl-lines" and chord_context_restored["draw"]["e8ChordEdges"] == 21840, str(chord_context_restored))
            check("E8 roots keep the dense inner rings legible", 1.8 <= initial_draw["minPointRadius"] <= initial_draw["maxPointRadius"] <= 3.1 and initial_draw["maxPointRadius"] / initial_draw["minPointRadius"] < 1.7, str(initial_draw))
            check("initial draw has no context ray stroke", initial_draw["rays"] == 0 and initial_draw["rayStrokes"] == 0, str(initial_draw))
            check("rings are batched into one stroke", initial_draw["ringStrokes"] == 1, str(initial_draw))
            check("base points batch across the full palette", initial_draw["batchedPoints"] == 228 and initial_draw["pointBatchFills"] == 5 and initial_draw["directPoints"] == 12, str(initial_draw))
            check("direct highlighted points preserve glow fills", initial_draw["directPointFills"] == initial_draw["directPoints"] * 2, str(initial_draw))
            check("settled initial draw renders glow halos", initial_draw["glowFills"] == initial_draw["directPoints"] and initial_draw["glowsSkippedForInteraction"] == 0, str(initial_draw))
            check("initial draw uses reusable point queues", initial_draw["drawMaskWrites"] == 240 and initial_draw["directQueuePoints"] == initial_draw["directPoints"] == 12 and initial_draw["directPointObjectAllocs"] == 0 and initial_draw["baseBucketCount"] == initial_draw["pointBatchFills"] == 5, str(initial_draw))
            check("initial draw uses cached alpha colors", initial_draw["alphaColorCacheHits"] == initial_draw["directPoints"] + 1 and initial_draw["alphaColorRuntimeParses"] == 0, str(initial_draw))
            check("initial draw uses precomputed geometry", initial_draw["baseSizeCacheHits"] == 240 and initial_draw["fillSlotCacheHits"] == initial_draw["batchedPoints"] and initial_draw["ringScaleFactors"] == initial_draw["rings"], str(initial_draw))
            check("initial draw projects directly into point cache", initial_draw["projectedPoints"] == 240 and initial_draw["projectionObjectAllocs"] == 0 and metrics["lastProjectionSource"] == "direct-point-fields" and metrics["lastProjectionCount"] == 240, str(metrics))
            render_frame = metrics["lastRenderAllFrame"]
            live_frame = metrics["allFrame"]
            check("render bounds reuse projected points", metrics["lastRenderFrameSource"] == "projected-points" and metrics["renderFrameReuseCount"] == metrics["renderCount"], str(metrics))
            check("render bounds match live all-frame bounds", render_frame["withinView"] == live_frame["withinView"] and abs(render_frame["width"] - live_frame["width"]) < 0.1 and abs(render_frame["height"] - live_frame["height"]) < 0.1, f"{render_frame} vs {live_frame}")
            check("initial render sets canvas layout cache", metrics["canvasStyleSyncCount"] >= 1 and metrics["canvasTransformSetCount"] >= 1, str(metrics))
            top_chrome = page.evaluate("""() => {
                const scene = document.getElementById('scene-chip').getBoundingClientRect();
                const quality = document.getElementById('quality-chip').getBoundingClientRect();
                const topbar = document.querySelector('.topbar');
                return {
                    scene: { width: scene.width, height: scene.height, text: document.getElementById('scene-chip').textContent.trim().replace(/\\s+/g, ' ') },
                    sceneTag: document.getElementById('scene-chip').tagName,
                    sceneLabel: document.getElementById('scene-chip').getAttribute('aria-label'),
                    quality: { width: quality.width, height: quality.height, text: document.getElementById('quality-chip').textContent.trim() },
                    ariaLabel: topbar.getAttribute('aria-label'),
                    canvasLabel: document.getElementById('mobile-canvas').getAttribute('aria-label'),
                    infoCopy: document.getElementById('info-copy').textContent,
                    metrics: window.__mobileApp.getMetrics()
                };
            }""")
            check("top scene chip keeps compact canvas footprint", top_chrome["scene"]["width"] <= 124 and top_chrome["scene"]["height"] <= 38 and top_chrome["scene"]["text"] == "E8 240 / 8 rings", str(top_chrome))
            check("top scene chip is a tappable scene control", top_chrome["sceneTag"] == "BUTTON" and "Tap to switch" in top_chrome["sceneLabel"], str(top_chrome))
            check("top quality chip stays compact and accessible", top_chrome["quality"]["width"] <= 88 and top_chrome["quality"]["height"] <= 38 and top_chrome["quality"]["text"] == "Smooth" and "240 roots" in top_chrome["ariaLabel"], str(top_chrome))
            check("default scene labels describe E8 Coxeter", "8 rings" in top_chrome["canvasLabel"] and "eight concentric rings of 30 roots" in top_chrome["infoCopy"] and top_chrome["metrics"]["lastSceneLabel"] == "E8 Coxeter, 240 roots, 8 rings", str(top_chrome))
            steady_canvas_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.evaluate("() => window.__mobileApp.forceRender()")
            steady_canvas_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("steady render skips canvas backing resize", steady_canvas_after["canvasResizeCount"] == steady_canvas_before["canvasResizeCount"], str(steady_canvas_after))
            check("steady render skips canvas style sync", steady_canvas_after["canvasStyleSyncSkipCount"] > steady_canvas_before["canvasStyleSyncSkipCount"] and steady_canvas_after["canvasStyleSyncCount"] == steady_canvas_before["canvasStyleSyncCount"], str(steady_canvas_after))
            check("steady render skips canvas transform reset", steady_canvas_after["canvasTransformSkipCount"] > steady_canvas_before["canvasTransformSkipCount"] and steady_canvas_after["canvasTransformSetCount"] == steady_canvas_before["canvasTransformSetCount"], str(steady_canvas_after))
            page.evaluate("() => window.__mobileApp.flushSave()")
            state_noop_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.evaluate("""() => {
                const state = window.__mobileApp.getState();
                window.__mobileApp.setState({
                    palette: state.palette,
                    quality: state.quality,
                    subset: state.subset,
                    zoom: state.zoom,
                    selectedRoot: state.selectedRoot
                });
            }""")
            state_noop_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("same state patch skips save sync and render", state_noop_after["stateNoopSkipCount"] > state_noop_before["stateNoopSkipCount"] and state_noop_after["lastStateNoopSkip"] == "set-state" and state_noop_after["saveCount"] == state_noop_before["saveCount"] and state_noop_after["controlSyncCount"] == state_noop_before["controlSyncCount"] and state_noop_after["renderCount"] == state_noop_before["renderCount"] and not state_noop_after["renderQueued"], str(state_noop_after))
            quality_chip_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#quality-chip").click()
            quality_feedback = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("quality chip toggles Smooth to Balanced", quality_feedback["state"]["quality"] == "balanced", str(quality_feedback))
            check("quality chip resizes canvas immediately", abs(quality_feedback["metrics"]["renderScale"] - 1.0) < 0.01 and not quality_feedback["metrics"]["settingsCanvasResizeDeferred"], str(quality_feedback["metrics"]))
            check("quality chip skips full control sync", quality_feedback["metrics"]["qualityChipSyncSkipCount"] > quality_chip_before["qualityChipSyncSkipCount"] and quality_feedback["metrics"]["controlSyncCount"] == quality_chip_before["controlSyncCount"] and quality_feedback["metrics"]["liveControlSyncSkipCount"] == quality_chip_before["liveControlSyncSkipCount"], str(quality_feedback["metrics"]))
            check("quality chip shows action status", quality_feedback["metrics"]["statusVisible"] and quality_feedback["metrics"]["statusText"] == "Quality: Balanced", str(quality_feedback["metrics"]))
            page.locator("#quality-chip").click()
            safe_quality_feedback = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("quality chip avoids Sharp quick cycle", safe_quality_feedback["state"]["quality"] == "smooth", str(safe_quality_feedback))
            check("quality chip toggles Balanced to Smooth", abs(safe_quality_feedback["metrics"]["renderScale"] - 0.75) < 0.01 and safe_quality_feedback["metrics"]["statusText"] == "Quality: Smooth", str(safe_quality_feedback["metrics"]))
            check("quality chip stays on lightweight sync path", safe_quality_feedback["metrics"]["qualityChipSyncSkipCount"] > quality_feedback["metrics"]["qualityChipSyncSkipCount"] and safe_quality_feedback["metrics"]["controlSyncCount"] == quality_feedback["metrics"]["controlSyncCount"] and safe_quality_feedback["metrics"]["liveControlSyncSkipCount"] == quality_feedback["metrics"]["liveControlSyncSkipCount"], str(safe_quality_feedback["metrics"]))
            page.evaluate("() => window.__mobileApp.hideStatus()")

            scene_step_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#scene-chip").click()
            page.wait_for_function("() => window.__mobileApp.getState().modelMode === 'bloom'")
            scene_step_forward = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                chip: document.getElementById('scene-chip').textContent.trim().replace(/\\s+/g, ' '),
                label: document.getElementById('scene-chip').getAttribute('aria-label'),
                width: document.getElementById('scene-chip').getBoundingClientRect().width,
                scrollWidth: document.getElementById('scene-chip').scrollWidth
            })""")
            check("scene chip advances to Bloom", scene_step_forward["state"]["modelMode"] == "bloom" and scene_step_forward["chip"] == "Bloom Shape / 0.00", str(scene_step_forward))
            check("Bloom scene chip copy fits the compact control", scene_step_forward["width"] <= 124 and scene_step_forward["scrollWidth"] <= scene_step_forward["width"] + 1, str(scene_step_forward))
            check("scene chip updates compact accessibility label", "Designed Bloom" in scene_step_forward["label"] and scene_step_forward["metrics"]["lastSceneChipLabel"] == scene_step_forward["label"], str(scene_step_forward))
            check("scene chip uses lightweight sync path", scene_step_forward["metrics"]["sceneChipStepCount"] > scene_step_before["sceneChipStepCount"] and scene_step_forward["metrics"]["sceneChipSyncSkipCount"] > scene_step_before["sceneChipSyncSkipCount"] and scene_step_forward["metrics"]["controlSyncCount"] == scene_step_before["controlSyncCount"] and scene_step_forward["metrics"]["lastInteractionType"] == "scene-chip-next", str(scene_step_forward["metrics"]))
            page.evaluate("() => window.__mobileApp.stepScene(-1)")
            page.wait_for_function("() => window.__mobileApp.getState().modelMode === 'e8_2d'")
            scene_step_back = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                chip: document.getElementById('scene-chip').textContent.trim().replace(/\\s+/g, ' ')
            })""")
            check("debug scene step returns to E8 Coxeter", scene_step_back["state"]["modelMode"] == "e8_2d" and scene_step_back["chip"] == "E8 240 / 8 rings", str(scene_step_back))
            check("scene step records target metrics", scene_step_back["metrics"]["lastSceneChipTarget"]["modelMode"] == "e8_2d" and scene_step_back["metrics"]["lastSceneChipIndex"] == 0 and scene_step_back["metrics"]["lastInteractionType"] == "scene-chip-prev", str(scene_step_back["metrics"]))
            page.evaluate("() => window.__mobileApp.hideStatus()")

            scene_swipe_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            scene_swipe_next = page.evaluate("""() => {
                const chip = document.getElementById('scene-chip');
                chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 81, pointerType: 'touch', button: 0, clientX: 118, clientY: 28 }));
                chip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 81, pointerType: 'touch', clientX: 78, clientY: 29 }));
                chip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 81, pointerType: 'touch', clientX: 76, clientY: 29 }));
                return {
                    state: window.__mobileApp.getState(),
                    metrics: window.__mobileApp.getMetrics(),
                    chip: chip.textContent.trim().replace(/\\s+/g, ' ')
                };
            }""")
            check("scene chip swipe left advances scene", scene_swipe_next["state"]["modelMode"] == "bloom" and scene_swipe_next["chip"] == "Bloom Shape / 0.00", str(scene_swipe_next))
            check("scene chip swipe left records gesture telemetry", scene_swipe_next["metrics"]["sceneChipSwipeCount"] > scene_swipe_before["sceneChipSwipeCount"] and scene_swipe_next["metrics"]["lastSceneChipGesture"] == "swipe-next" and scene_swipe_next["metrics"]["lastSceneChipSwipeDirection"] == "next" and scene_swipe_next["metrics"]["lastInteractionType"] == "scene-chip-swipe-next", str(scene_swipe_next["metrics"]))
            scene_swipe_prev = page.evaluate("""() => {
                const chip = document.getElementById('scene-chip');
                chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 82, pointerType: 'touch', button: 0, clientX: 76, clientY: 28 }));
                chip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 82, pointerType: 'touch', clientX: 118, clientY: 28 }));
                chip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 82, pointerType: 'touch', clientX: 120, clientY: 28 }));
                return {
                    state: window.__mobileApp.getState(),
                    metrics: window.__mobileApp.getMetrics(),
                    chip: chip.textContent.trim().replace(/\\s+/g, ' ')
                };
            }""")
            check("scene chip swipe right returns previous scene", scene_swipe_prev["state"]["modelMode"] == "e8_2d" and scene_swipe_prev["chip"] == "E8 240 / 8 rings", str(scene_swipe_prev))
            check("scene chip swipe right records gesture telemetry", scene_swipe_prev["metrics"]["sceneChipSwipeCount"] == scene_swipe_next["metrics"]["sceneChipSwipeCount"] + 1 and scene_swipe_prev["metrics"]["lastSceneChipGesture"] == "swipe-prev" and scene_swipe_prev["metrics"]["lastSceneChipSwipeDirection"] == "prev" and scene_swipe_prev["metrics"]["lastInteractionType"] == "scene-chip-swipe-prev", str(scene_swipe_prev["metrics"]))
            scene_hold_before = page.evaluate("() => { window.__mobileApp.closeSettings(); return window.__mobileApp.getMetrics(); }")
            page.evaluate("""() => new Promise(resolve => {
                const chip = document.getElementById('scene-chip');
                chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 83, pointerType: 'touch', button: 0, clientX: 96, clientY: 28 }));
                setTimeout(() => {
                    chip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 83, pointerType: 'touch', clientX: 96, clientY: 28 }));
                    resolve();
                }, 620);
            })""")
            scene_hold = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("scene chip hold opens View settings", scene_hold["settingsOpen"] and scene_hold["settingsSection"] == "view" and scene_hold["lastInteractionType"] == "scene-chip-hold-view", str(scene_hold))
            check("scene chip hold records gesture telemetry", scene_hold["sceneChipLongPressCount"] > scene_hold_before["sceneChipLongPressCount"] and scene_hold["sceneChipOpenSettingsCount"] > scene_hold_before["sceneChipOpenSettingsCount"] and scene_hold["lastSceneChipGesture"] == "hold-view", str(scene_hold))
            redundant_scene_catalog = page.evaluate("""() => ({
                panel: document.querySelector('.scene-preset-panel'),
                grid: document.getElementById('scene-preset-grid'),
                buttons: document.querySelectorAll('[data-scene-preset]').length,
                models: document.getElementById('model-shortcut-groups')
            })""")
            check("View removes the redundant Scenes catalog", redundant_scene_catalog["panel"] is None and redundant_scene_catalog["grid"] is None and redundant_scene_catalog["buttons"] == 0 and redundant_scene_catalog["models"] is not None, str(redundant_scene_catalog))
            model_shortcuts = page.evaluate("""() => ({
                groups: [...document.querySelectorAll('#model-shortcut-groups [data-model-shortcut-group]')].map(group => ({
                    id: group.dataset.modelShortcutGroup,
                    buttons: [...group.querySelectorAll('[data-model-shortcut]')].map(button => ({
                        id: button.dataset.modelShortcut,
                        text: button.textContent.trim(),
                        active: button.classList.contains('active'),
                        pressed: button.getAttribute('aria-pressed')
                    }))
                })),
                output: document.getElementById('model-shortcut-output').textContent.trim(),
                metrics: window.__mobileApp.getMetrics()
            })""")
            model_shortcut_ids = [button["id"] for group in model_shortcuts["groups"] for button in group["buttons"]]
            model_shortcut_group_counts = {group["id"]: len(group["buttons"]) for group in model_shortcuts["groups"]}
            check("View section exposes full grouped model shortcuts", len(model_shortcut_ids) == 21 and model_shortcuts["metrics"]["modelShortcutButtonCount"] == 21 and model_shortcut_group_counts == {"views": 3, "solids": 5, "stars": 4, "poly4d": 6, "dynkin": 3} and "bloom" in model_shortcut_ids and "sdf" in model_shortcut_ids and "shape-icosahedron" in model_shortcut_ids and "shape-great_icosahedron" in model_shortcut_ids and "poly-120cell" in model_shortcut_ids and "dynkin-E6" in model_shortcut_ids and "dynkin-E8" in model_shortcut_ids, str(model_shortcuts))
            model_options = page.locator("#model-select option").evaluate_all("options => options.map(option => option.value)")
            check("model selector replaces legacy E8 3D with Bloom and SDF", model_options == ["bloom", "e8_2d", "sdf", "platonic", "poly4d", "dynkin"], str(model_options))
            fallback_selectors_hidden = page.evaluate("""() => [
                document.getElementById('model-select').closest('label'),
                document.getElementById('shape-field'),
                document.getElementById('polytope4d-field'),
                document.getElementById('dynkin-field')
            ].every(field => field.hidden && getComputedStyle(field).display === 'none')""")
            check("Models is the sole visible selection surface", fallback_selectors_hidden)
            dynkin_options = page.locator("#dynkin-select option").evaluate_all("options => options.map(option => option.value)")
            check("mobile Dynkin catalog matches desktop-facing E-series", dynkin_options == ["E8", "E7", "E6"], str(dynkin_options))
            check("model shortcuts mark active E8 Coxeter", model_shortcuts["output"] == "E8 Coxeter" and any(button["id"] == "e8_2d" and button["active"] and button["pressed"] == "true" for group in model_shortcuts["groups"] for button in group["buttons"]), str(model_shortcuts))
            model_shortcut_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#model-shortcut-groups [data-model-shortcut="shape-cube"]').click()
            model_shortcut_cube = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    modelMode: document.getElementById('model-select').value,
                    shape: document.getElementById('shape-select').value,
                    shapeVisible: !document.getElementById('shape-field').classList.contains('hidden'),
                    activeShortcut: document.querySelector('#model-shortcut-groups button.active')?.dataset.modelShortcut,
                    output: document.getElementById('model-shortcut-output').textContent.trim()
                }
            })""")
            check("model shortcut selects Platonic solid", model_shortcut_cube["state"]["modelMode"] == "platonic" and model_shortcut_cube["state"]["shape"] == "cube" and model_shortcut_cube["state"]["selectedRoot"] is None and model_shortcut_cube["controls"]["modelMode"] == "platonic" and model_shortcut_cube["controls"]["shape"] == "cube" and model_shortcut_cube["controls"]["shapeVisible"] and model_shortcut_cube["controls"]["activeShortcut"] == "shape-cube" and model_shortcut_cube["controls"]["output"] == "Cube", str(model_shortcut_cube))
            check("model shortcut uses lightweight settings sync", model_shortcut_cube["metrics"]["modelShortcutSelectCount"] > model_shortcut_before["modelShortcutSelectCount"] and model_shortcut_cube["metrics"]["modelShortcutSyncSkipCount"] > model_shortcut_before["modelShortcutSyncSkipCount"] and model_shortcut_cube["metrics"]["controlSyncCount"] == model_shortcut_before["controlSyncCount"] and model_shortcut_cube["metrics"]["lastModelShortcutId"] == "shape-cube" and model_shortcut_cube["metrics"]["lastModelShortcutGroup"] == "solids" and model_shortcut_cube["metrics"]["lastInteractionType"] == "model-shortcut-shape-cube", str(model_shortcut_cube["metrics"]))
            page.locator('#model-shortcut-groups [data-model-shortcut="poly-tesseract"]').click()
            model_shortcut_poly = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    modelMode: document.getElementById('model-select').value,
                    polytope4d: document.getElementById('polytope4d-select').value,
                    polyVisible: !document.getElementById('polytope4d-field').classList.contains('hidden'),
                    shapeHidden: document.getElementById('shape-field').classList.contains('hidden'),
                    activeShortcut: document.querySelector('#model-shortcut-groups button.active')?.dataset.modelShortcut,
                    output: document.getElementById('model-shortcut-output').textContent.trim()
                }
            })""")
            check("model shortcut selects 4D polytope", model_shortcut_poly["state"]["modelMode"] == "poly4d" and model_shortcut_poly["state"]["polytope4d"] == "tesseract" and model_shortcut_poly["controls"]["modelMode"] == "poly4d" and model_shortcut_poly["controls"]["polytope4d"] == "tesseract" and model_shortcut_poly["controls"]["polyVisible"] and model_shortcut_poly["controls"]["shapeHidden"] and model_shortcut_poly["controls"]["activeShortcut"] == "poly-tesseract" and model_shortcut_poly["controls"]["output"] == "Tesseract" and model_shortcut_poly["metrics"]["lastModelShortcutId"] == "poly-tesseract", str(model_shortcut_poly))
            page.locator('#model-shortcut-groups [data-model-shortcut="dynkin-E6"]').click()
            model_shortcut_dynkin = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    modelMode: document.getElementById('model-select').value,
                    dynkinDiagram: document.getElementById('dynkin-select').value,
                    dynkinVisible: !document.getElementById('dynkin-field').classList.contains('hidden'),
                    polyHidden: document.getElementById('polytope4d-field').classList.contains('hidden'),
                    activeShortcut: document.querySelector('#model-shortcut-groups button.active')?.dataset.modelShortcut,
                    output: document.getElementById('model-shortcut-output').textContent.trim()
                }
            })""")
            check("model shortcut selects non-E8 Dynkin diagram", model_shortcut_dynkin["state"]["modelMode"] == "dynkin" and model_shortcut_dynkin["state"]["dynkinDiagram"] == "E6" and model_shortcut_dynkin["controls"]["modelMode"] == "dynkin" and model_shortcut_dynkin["controls"]["dynkinDiagram"] == "E6" and model_shortcut_dynkin["controls"]["dynkinVisible"] and model_shortcut_dynkin["controls"]["polyHidden"] and model_shortcut_dynkin["controls"]["activeShortcut"] == "dynkin-E6" and model_shortcut_dynkin["controls"]["output"] == "E6 Dynkin" and model_shortcut_dynkin["metrics"]["lastModelShortcutTarget"]["dynkinDiagram"] == "E6", str(model_shortcut_dynkin))
            page.locator("#dynkin-select").evaluate("el => { el.value = 'E7'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            model_shortcut_select_sync = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                activeShortcut: document.querySelector('#model-shortcut-groups button.active')?.dataset.modelShortcut,
                output: document.getElementById('model-shortcut-output').textContent.trim()
            })""")
            check("fallback Dynkin select syncs model shortcut", model_shortcut_select_sync["state"]["dynkinDiagram"] == "E7" and model_shortcut_select_sync["activeShortcut"] == "dynkin-E7" and model_shortcut_select_sync["output"] == "E7 Dynkin" and model_shortcut_select_sync["metrics"]["lastSettingsControlSyncSkip"] == "dynkin-select", str(model_shortcut_select_sync))
            page.evaluate("() => window.__mobileApp.selectModelShortcut('bloom')")
            model_shortcut_bloom = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    modelMode: document.getElementById('model-select').value,
                    activeShortcut: document.querySelector('#model-shortcut-groups button.active')?.dataset.modelShortcut,
                    output: document.getElementById('model-shortcut-output').textContent.trim()
                }
            })""")
            check("debug API selects Bloom model shortcut", model_shortcut_bloom["state"]["modelMode"] == "bloom" and model_shortcut_bloom["controls"]["modelMode"] == "bloom" and model_shortcut_bloom["controls"]["activeShortcut"] == "bloom" and model_shortcut_bloom["controls"]["output"] == "Designed Bloom" and model_shortcut_bloom["metrics"]["lastModelShortcutId"] == "bloom", str(model_shortcut_bloom))
            page.evaluate("() => window.__mobileApp.selectModelShortcut('sdf')")
            model_shortcut_sdf = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    modelMode: document.getElementById('model-select').value,
                    activeShortcut: document.querySelector('#model-shortcut-groups button.active')?.dataset.modelShortcut,
                    output: document.getElementById('model-shortcut-output').textContent.trim()
                }
            })""")
            check("debug API selects SDF model shortcut", model_shortcut_sdf["state"]["modelMode"] == "sdf" and model_shortcut_sdf["controls"]["modelMode"] == "sdf" and model_shortcut_sdf["controls"]["activeShortcut"] == "sdf" and model_shortcut_sdf["controls"]["output"] == "E8 distance field" and model_shortcut_sdf["metrics"]["lastModelShortcutId"] == "sdf", str(model_shortcut_sdf))
            model_shortcut_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#model-shortcut-groups [data-model-shortcut="poly-16cell"]').click()
            model_shortcut_16cell = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    modelMode: document.getElementById('model-select').value,
                    polytope4d: document.getElementById('polytope4d-select').value,
                    polyVisible: !document.getElementById('polytope4d-field').classList.contains('hidden'),
                    activeShortcut: document.querySelector('#model-shortcut-groups button.active')?.dataset.modelShortcut,
                    output: document.getElementById('model-shortcut-output').textContent.trim()
                }
            })""")
            check("Models retains the complete 16-cell selection", model_shortcut_16cell["state"]["modelMode"] == "poly4d" and model_shortcut_16cell["state"]["polytope4d"] == "16cell" and model_shortcut_16cell["controls"]["modelMode"] == "poly4d" and model_shortcut_16cell["controls"]["polytope4d"] == "16cell" and model_shortcut_16cell["controls"]["polyVisible"] and model_shortcut_16cell["controls"]["activeShortcut"] == "poly-16cell" and model_shortcut_16cell["controls"]["output"] == "16-cell", str(model_shortcut_16cell))
            check("16-cell model shortcut keeps lightweight settings sync", model_shortcut_16cell["metrics"]["modelShortcutSelectCount"] > model_shortcut_before["modelShortcutSelectCount"] and model_shortcut_16cell["metrics"]["modelShortcutSyncSkipCount"] > model_shortcut_before["modelShortcutSyncSkipCount"] and model_shortcut_16cell["metrics"]["controlSyncCount"] == model_shortcut_before["controlSyncCount"] and model_shortcut_16cell["metrics"]["lastModelShortcutId"] == "poly-16cell" and model_shortcut_16cell["metrics"]["lastInteractionType"] == "model-shortcut-poly-16cell", str(model_shortcut_16cell["metrics"]))
            page.locator('#model-shortcut-groups [data-model-shortcut="shape-dodecahedron"]').click()
            model_shortcut_dodecahedron = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                activeShortcut: document.querySelector('#model-shortcut-groups button.active')?.dataset.modelShortcut,
                output: document.getElementById('model-shortcut-output').textContent.trim()
            })""")
            check("Models retains direct Dodecahedron selection", model_shortcut_dodecahedron["state"]["modelMode"] == "platonic" and model_shortcut_dodecahedron["state"]["shape"] == "dodecahedron" and model_shortcut_dodecahedron["activeShortcut"] == "shape-dodecahedron" and model_shortcut_dodecahedron["output"] == "Dodecahedron", str(model_shortcut_dodecahedron))
            model_replacement_sync = page.evaluate("""() => {
                const app = window.__mobileApp;
                app.openSettings('motion');
                app.setState({
                    autoColor: true,
                    softFx: true,
                    autoRotate: true,
                    autoZoom: true,
                    autoExtrude: true,
                    autoModel: true,
                    rotationSpeed: 1.2,
                    cameraPath: 'spiral',
                    cameraTilt: 0.8
                });
                app.selectModelShortcut('shape-cube');
                return {
                    state: app.getState(),
                    controls: {
                        autoColor: document.getElementById('auto-color-toggle').checked,
                        softFx: document.getElementById('soft-fx-toggle').checked,
                        motion: document.getElementById('motion-toggle').checked,
                        autoModel: document.getElementById('auto-model-toggle').checked,
                        activeFx: document.querySelector('#fx-preset-grid button.active')?.dataset.fxPreset,
                        fxOutput: document.getElementById('fx-preset-output').textContent.trim(),
                        activeMotion: document.querySelector('#motion-preset-grid button.active')?.dataset.motionAction,
                        motionOutput: document.getElementById('motion-preset-output').textContent.trim(),
                        activeSpeed: document.querySelector('#motion-speed-grid button.active')?.dataset.motionSpeed,
                        speedOutput: document.getElementById('motion-speed-output').textContent.trim(),
                        cameraPath: document.getElementById('camera-path-output').textContent.trim()
                    }
                };
            }""")
            check("model replacement resets runtime state without changing desktop behavior", not model_replacement_sync["state"]["autoColor"] and not model_replacement_sync["state"]["softFx"] and not model_replacement_sync["state"]["autoRotate"] and not model_replacement_sync["state"]["autoZoom"] and not model_replacement_sync["state"]["autoExtrude"] and not model_replacement_sync["state"]["autoModel"] and abs(model_replacement_sync["state"]["rotationSpeed"] - 0.7) < 0.01 and model_replacement_sync["state"]["cameraPath"] == "manual" and abs(model_replacement_sync["state"]["cameraTilt"] - 0.28) < 0.01, str(model_replacement_sync))
            check("model replacement immediately synchronizes Visuals and Motion controls", not model_replacement_sync["controls"]["autoColor"] and not model_replacement_sync["controls"]["softFx"] and not model_replacement_sync["controls"]["motion"] and not model_replacement_sync["controls"]["autoModel"] and model_replacement_sync["controls"]["activeFx"] == "clean" and model_replacement_sync["controls"]["fxOutput"] == "Static" and model_replacement_sync["controls"]["activeMotion"] == "still" and model_replacement_sync["controls"]["motionOutput"] == "Still" and model_replacement_sync["controls"]["activeSpeed"] == "medium" and model_replacement_sync["controls"]["speedOutput"] == "Medium" and model_replacement_sync["controls"]["cameraPath"] == "Manual", str(model_replacement_sync["controls"]))
            page.evaluate("() => { window.__mobileApp.selectModelShortcut('e8_2d'); window.__mobileApp.hideStatus(); }")
            contextual_controls = page.evaluate("""() => {
                const app = window.__mobileApp;
                const visibility = () => Object.fromEntries(['e8-roots', 'e8-only', 'vertex-models'].map(context => [
                    context,
                    [...document.querySelectorAll(`[data-model-context="${context}"]`)].map(control => ({
                        hidden: control.hidden,
                        ariaHidden: control.getAttribute('aria-hidden')
                    }))
                ]));
                app.setState({
                    modelMode: 'e8_2d',
                    subset: 'dodecahedron',
                    highlightSubset: false,
                    showContext: false,
                    showPetrie: true,
                    showMirrors: true
                });
                const e8 = { visibility: visibility(), state: app.getState() };
                app.selectModelShortcut('bloom');
                const bloom = { visibility: visibility(), state: app.getState() };
                app.selectModelShortcut('sdf');
                const sdf = { visibility: visibility(), state: app.getState() };
                app.selectModelShortcut('poly-24cell');
                const poly4d = { visibility: visibility(), state: app.getState() };
                app.selectModelShortcut('shape-icosahedron');
                const platonic = { visibility: visibility(), state: app.getState() };
                app.selectModelShortcut('dynkin-E8');
                const dynkin = { visibility: visibility(), state: app.getState() };
                app.selectModelShortcut('e8_2d');
                const restored = { visibility: visibility(), state: app.getState() };
                return { e8, bloom, sdf, poly4d, platonic, dynkin, restored };
            }""")
            all_visible = lambda controls: bool(controls) and all(not control["hidden"] and control["ariaHidden"] == "false" for control in controls)
            all_hidden = lambda controls: bool(controls) and all(control["hidden"] and control["ariaHidden"] == "true" for control in controls)
            check("E8 View exposes root controls without irrelevant vertex controls", all_visible(contextual_controls["e8"]["visibility"]["e8-roots"]) and all_visible(contextual_controls["e8"]["visibility"]["e8-only"]) and all_hidden(contextual_controls["e8"]["visibility"]["vertex-models"]), str(contextual_controls["e8"]))
            check("Bloom keeps root exploration but hides E8-only and vertex controls", all_visible(contextual_controls["bloom"]["visibility"]["e8-roots"]) and all_hidden(contextual_controls["bloom"]["visibility"]["e8-only"]) and all_hidden(contextual_controls["bloom"]["visibility"]["vertex-models"]), str(contextual_controls["bloom"]))
            for model_name in ["sdf", "dynkin"]:
                model = contextual_controls[model_name]
                check(f"{model_name.upper()} hides root and vertex controls", all_hidden(model["visibility"]["e8-roots"]) and all_hidden(model["visibility"]["e8-only"]) and all_hidden(model["visibility"]["vertex-models"]), str(model))
            for model_name in ["poly4d", "platonic"]:
                model = contextual_controls[model_name]
                check(f"{model_name.capitalize()} replaces root controls with Vertex nodes", all_hidden(model["visibility"]["e8-roots"]) and all_hidden(model["visibility"]["e8-only"]) and all_visible(model["visibility"]["vertex-models"]), str(model))
            restored_root_state = contextual_controls["restored"]["state"]
            check("hidden E8 controls retain their choices across model changes", restored_root_state["subset"] == "dodecahedron" and not restored_root_state["highlightSubset"] and not restored_root_state["showContext"] and restored_root_state["showPetrie"] and restored_root_state["showMirrors"] and all_visible(contextual_controls["restored"]["visibility"]["e8-roots"]) and all_visible(contextual_controls["restored"]["visibility"]["e8-only"]), str(contextual_controls["restored"]))
            page.evaluate("() => window.__mobileApp.setState({ subset: 'icosahedron', highlightSubset: true, showContext: true, showPetrie: false, showMirrors: false })")
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.hideStatus(); }")
            page.wait_for_timeout(450)

            settings_defer_probe = page.evaluate(
                """() => {
                    window.__mobileApp.closeSettings();
                    window.__mobileApp.flushSave();
                    const before = window.__mobileApp.getMetrics();
                    window.__mobileApp.setState({ palette: 'ember' });
                    const queued = window.__mobileApp.getMetrics();
                    window.__mobileApp.openSettings('style');
                    const opened = window.__mobileApp.getMetrics();
                    return { before, queued, opened };
                }"""
            )
            check("state change queues visible render before settings", settings_defer_probe["queued"]["renderQueued"] and settings_defer_probe["queued"]["renderCount"] == settings_defer_probe["before"]["renderCount"], str(settings_defer_probe))
            check("settings open cancels queued hidden render", not settings_defer_probe["opened"]["renderQueued"] and settings_defer_probe["opened"]["settingsOpenRenderCancelCount"] > settings_defer_probe["before"]["settingsOpenRenderCancelCount"] and settings_defer_probe["opened"]["settingsDeferredRenderPending"] and settings_defer_probe["opened"]["lastSettingsDeferredRenderReason"] == "settings-open", str(settings_defer_probe))
            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.wait_for_function("count => window.__mobileApp.getMetrics().renderCount > count", arg=settings_defer_probe["opened"]["renderCount"])
            settings_defer_flush = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("settings close flushes deferred render", not settings_defer_flush["settingsDeferredRenderPending"] and settings_defer_flush["settingsDeferredRenderFlushCount"] > settings_defer_probe["opened"]["settingsDeferredRenderFlushCount"] and settings_defer_flush["lastSettingsDeferredRenderFlushReason"] == "settings-open", str(settings_defer_flush))
            page.evaluate("() => { window.__mobileApp.setState({ palette: 'gold' }); window.__mobileApp.forceRender(); window.__mobileApp.flushSave(); }")

            settings_button = page.locator("#settings-button").bounding_box()
            settings_button_text = page.locator("#settings-button").evaluate("el => el.textContent.trim()")
            check("settings button keeps compact canvas footprint", bool(settings_button) and 44 <= settings_button["width"] <= 56 and 44 <= settings_button["height"] <= 56 and settings_button_text == "", str({"box": settings_button, "text": settings_button_text}))
            page.get_by_role("button", name="Settings").click()
            check("settings button opens sheet", page.locator("#settings-sheet:not(.hidden)").count() == 1)
            section_nav_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            for name in ["View", "Visuals", "Motion", "Quality", "Info"]:
                page.get_by_role("button", name=name, exact=True).click()
                active = page.evaluate(
                    """sectionName => {
                        const heading = document.querySelector('.settings-section.active h2');
                        return heading && heading.textContent.trim() === sectionName;
                    }""",
                    name,
                )
                check(f"{name} section reachable", bool(active))
            section_nav_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("settings tab switches skip full control sync", section_nav_after["settingsTabSyncSkipCount"] >= section_nav_before["settingsTabSyncSkipCount"] + 5 and section_nav_after["controlSyncCount"] == section_nav_before["controlSyncCount"], str(section_nav_after))
            check("settings section switches use cached controls", section_nav_after["settingsSectionSwitchCount"] >= section_nav_before["settingsSectionSwitchCount"] + 4 and section_nav_after["settingsSectionSwitchSkipCount"] >= section_nav_before["settingsSectionSwitchSkipCount"] + 1 and section_nav_after["lastSettingsSectionSwitch"] == "info", str(section_nav_after))
            page.get_by_role("button", name="Info", exact=True).click()
            same_section = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("same settings section skips DOM toggles", same_section["settingsSectionSwitchSkipCount"] > section_nav_after["settingsSectionSwitchSkipCount"] and same_section["settingsSectionSwitchCount"] == section_nav_after["settingsSectionSwitchCount"] and same_section["controlSyncCount"] == section_nav_after["controlSyncCount"], str(same_section))
            cartan_info = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                text: document.getElementById('cartan-matrix').innerText
            })""")
            check("Info section shows compact Cartan matrix", cartan_info["metrics"]["cartanMatrixSize"] == 8 and cartan_info["metrics"]["cartanMatrixNonzeroCount"] == 22 and "Cartan matrix" in cartan_info["text"] and "a1" in cartan_info["text"], str(cartan_info))
            mckay_info = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                text: document.getElementById('mckay-card').innerText
            })""")
            check("Info section shows McKay bridge card", mckay_info["metrics"]["lastMckaySource"] == "icosahedron" and mckay_info["metrics"]["lastMckayRoots"] == "E8" and mckay_info["metrics"]["lastMckaySymmetry"] == "I" and "McKay bridge" in mckay_info["text"] and "Icosahedron" in mckay_info["text"] and "12 illustrative E8 highlights" in mckay_info["text"], str(mckay_info))
            curiosity_info = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                text: document.getElementById('curiosity-card').innerText,
                button: document.getElementById('curiosity-next').getBoundingClientRect()
            })""")
            check("Info section shows compact context note", curiosity_info["metrics"]["lastCuriosityTitle"] == "Coxeter plane" and "Coxeter plane" in curiosity_info["text"] and "eight rings of 30" in curiosity_info["text"] and curiosity_info["button"]["height"] >= 40, str(curiosity_info))
            curiosity_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#curiosity-next").click()
            curiosity_next = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                text: document.getElementById('curiosity-card').innerText
            })""")
            check("Context note cycles without canvas work", curiosity_next["metrics"]["curiosityNextCount"] > curiosity_before["curiosityNextCount"] and curiosity_next["metrics"]["lastCuriosityTitle"] == "McKay lens" and curiosity_next["metrics"]["lastInteractionType"] == "next-curiosity" and curiosity_next["metrics"]["renderCount"] == curiosity_before["renderCount"] and "McKay lens" in curiosity_next["text"], str(curiosity_next))
            learn_panel = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                buttons: [...document.querySelectorAll('#learn-topic-grid [data-learn-topic]')].map(button => ({
                    id: button.dataset.learnTopic,
                    text: button.textContent.trim(),
                    active: button.classList.contains('active'),
                    effective: button.classList.contains('effective'),
                    pressed: button.getAttribute('aria-pressed'),
                    box: button.getBoundingClientRect()
                })),
                output: document.getElementById('learn-topic-output').textContent.trim(),
                card: document.getElementById('learn-topic-card').innerText,
                nextButton: document.getElementById('learn-topic-next').getBoundingClientRect()
            })""")
            learn_ids = [button["id"] for button in learn_panel["buttons"]]
            expected_lesson_ids = ["auto", "why-five-solids", "into-four-dimensions", "six-hundred-cell", "coxeter-plane", "roots-reflections", "mckay-bridge", "designed-bloom", "distance-fields"]
            check("Info section exposes shared curriculum lessons", learn_panel["state"]["learnTopic"] == "auto" and learn_ids == expected_lesson_ids and learn_panel["metrics"]["learnTopicButtonCount"] == len(expected_lesson_ids) and all(button["box"]["height"] >= 40 for button in learn_panel["buttons"]), str(learn_panel))
            check("Learn Auto follows current curriculum scene", learn_panel["output"] == "Auto: Coxeter plane" and any(button["id"] == "auto" and button["active"] and button["pressed"] == "true" for button in learn_panel["buttons"]) and any(button["id"] == "coxeter-plane" and button["effective"] for button in learn_panel["buttons"]) and "Move from the 600-cell" in learn_panel["card"] and "2 scoped sources" in learn_panel["card"] and learn_panel["nextButton"]["height"] >= 40, str(learn_panel))
            learn_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            mobile_lesson_select_ms = page.evaluate("""() => {
                const started = performance.now();
                document.querySelector('#learn-topic-grid [data-learn-topic="mckay-bridge"]')?.click();
                return performance.now() - started;
            }""")
            check("Mobile lesson selection meets interaction budget", mobile_lesson_select_ms <= 150, f"{mobile_lesson_select_ms:.1f}ms > 150ms")
            learn_mckay = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                output: document.getElementById('learn-topic-output').textContent.trim(),
                card: document.getElementById('learn-topic-card').innerText,
                active: document.querySelector('#learn-topic-grid button.active')?.dataset.learnTopic
            })""")
            check("Learn lesson chip pins McKay bridge", learn_mckay["state"]["learnTopic"] == "mckay-bridge" and learn_mckay["active"] == "mckay-bridge" and learn_mckay["output"] == "McKay correspondence" and "qualified relationships" in learn_mckay["card"] and "2 scoped sources" in learn_mckay["card"], str(learn_mckay))
            check("Learn lesson switch avoids hidden canvas render", learn_mckay["metrics"]["learnTopicSelectCount"] > learn_before["learnTopicSelectCount"] and learn_mckay["metrics"]["lastLearnTopic"] == "mckay-bridge" and learn_mckay["metrics"]["lastLearnTopicConfigured"] == "mckay-bridge" and learn_mckay["metrics"]["lastInteractionType"] == "learn-topic-mckay-bridge" and learn_mckay["metrics"]["renderCount"] == learn_before["renderCount"], str(learn_mckay["metrics"]))
            page.locator('[data-info-action="toggle-lesson-complete"]').click()
            learn_complete = page.evaluate("""() => ({
                progress: window.__mobileApp.getLearningProgress(),
                stored: JSON.parse(localStorage.getItem('e8_progress_v1') || '{}'),
                pressed: document.querySelector('[data-info-action="toggle-lesson-complete"]')?.getAttribute('aria-pressed'),
                label: document.querySelector('[data-info-action="toggle-lesson-complete"]')?.textContent.trim()
            })""")
            check("Mobile lesson completion uses shared progress ledger", bool(learn_complete["progress"]["lessons"].get("mckay-bridge")) and bool(learn_complete["stored"]["lessons"].get("mckay-bridge")) and learn_complete["pressed"] == "true" and learn_complete["label"] == "Completed", str(learn_complete))
            page.locator('#learn-topic-next').click()
            learn_next = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                output: document.getElementById('learn-topic-output').textContent.trim(),
                card: document.getElementById('learn-topic-card').innerText
            })""")
            check("Learn Next follows curriculum order", learn_next["state"]["learnTopic"] == "designed-bloom" and learn_next["output"] == "designed Bloom" and "qualified relationships" in learn_next["card"] and learn_next["metrics"]["learnTopicNextCount"] > learn_mckay["metrics"]["learnTopicNextCount"] and learn_next["metrics"]["lastInteractionType"] == "next-learn-topic", str(learn_next))
            check("Learn Next stays render-free", learn_next["metrics"]["renderCount"] == learn_mckay["metrics"]["renderCount"], str(learn_next["metrics"]))
            page.locator('#learn-topic-grid [data-learn-topic="auto"]').click()
            learn_auto = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                output: document.getElementById('learn-topic-output').textContent.trim(),
                card: document.getElementById('learn-topic-card').innerText
            })""")
            check("Learn Auto can be restored", learn_auto["state"]["learnTopic"] == "auto" and learn_auto["output"] == "Auto: Coxeter plane" and "Move from the 600-cell" in learn_auto["card"], str(learn_auto))
            page.evaluate("() => window.__mobileApp.flushSave()")
            tour_card = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                tour: window.__mobileApp.getMobileTourState(),
                metrics: window.__mobileApp.getMetrics(),
                output: document.getElementById('mobile-tour-output').textContent.trim(),
                step: document.getElementById('mobile-tour-step-output').textContent.trim(),
                copy: document.getElementById('mobile-tour-copy').innerText,
                buttons: [...document.querySelectorAll('#mobile-tour-card button')].map(button => ({
                    id: button.id,
                    text: button.textContent.trim(),
                    pressed: button.getAttribute('aria-pressed'),
                    disabled: button.disabled,
                    ariaDisabled: button.getAttribute('aria-disabled'),
                    box: button.getBoundingClientRect()
                }))
            })""")
            check("Info section exposes compact guided tour", tour_card["tour"]["count"] == 6 and tour_card["tour"]["index"] == 0 and tour_card["output"] == "Ready" and tour_card["step"] == "1/6" and "E8 Coxeter plane" in tour_card["copy"] and tour_card["metrics"]["mobileTourButtonCount"] == 3 and all(button["box"]["height"] >= 40 for button in tour_card["buttons"]), str(tour_card))
            check("Tour card keeps start action explicit", any(button["id"] == "mobile-tour-toggle" and button["text"] == "Start" and button["pressed"] == "false" for button in tour_card["buttons"]), str(tour_card["buttons"]))
            check("Tour step buttons are disabled until started", all(button["disabled"] and button["ariaDisabled"] == "true" for button in tour_card["buttons"] if button["id"] in ["mobile-tour-prev", "mobile-tour-next"]), str(tour_card["buttons"]))
            tour_start_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#mobile-tour-toggle").click()
            page.wait_for_function("() => window.__mobileApp.getMetrics().mobileTourActive === true")
            tour_start = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                tour: window.__mobileApp.getMobileTourState(),
                metrics: window.__mobileApp.getMetrics(),
                stored: window.__mobileApp.getStoredState()
            })""")
            check("Tour starts from Info and clears the sheet", tour_start["tour"]["active"] and tour_start["tour"]["timerActive"] and not tour_start["metrics"]["settingsOpen"] and tour_start["tour"]["step"]["id"] == "e8-coxeter" and tour_start["state"]["modelMode"] == "e8_2d", str(tour_start))
            check("Tour start keeps static conservative renderer", not tour_start["state"]["autoRotate"] and not tour_start["state"]["autoModel"] and not tour_start["state"]["autoColor"] and not tour_start["state"]["softFx"] and not tour_start["metrics"]["runtimeAnimationActive"] and not tour_start["metrics"]["motionActive"], str(tour_start))
            check("Tour start records runtime metrics", tour_start["metrics"]["mobileTourStartCount"] > tour_start_before["mobileTourStartCount"] and tour_start["metrics"]["mobileTourStepCount"] > tour_start_before["mobileTourStepCount"] and tour_start["metrics"]["lastMobileTourAction"] == "mobile-tour-start" and tour_start["metrics"]["lastInteractionType"] == "mobile-tour-start" and tour_start["metrics"]["statusText"] == "Tour: E8 roots", str(tour_start["metrics"]))
            tour_next_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            tour_next = page.evaluate("""() => {
                const result = window.__mobileApp.nextMobileTourStep({ schedule: false });
                return {
                    result,
                    state: window.__mobileApp.getState(),
                    tour: window.__mobileApp.getMobileTourState(),
                    metrics: window.__mobileApp.getMetrics(),
                    stored: window.__mobileApp.getStoredState()
                };
            }""")
            page.wait_for_function("() => window.__mobileApp.getState().modelMode === 'bloom'")
            tour_next = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                tour: window.__mobileApp.getMobileTourState(),
                metrics: window.__mobileApp.getMetrics(),
                stored: window.__mobileApp.getStoredState()
            })""")
            check("Tour Next steps to Bloom without extra chrome", tour_next["tour"]["active"] and not tour_next["tour"]["timerActive"] and tour_next["tour"]["index"] == 1 and tour_next["tour"]["step"]["id"] == "designed-bloom" and tour_next["state"]["modelMode"] == "bloom", str(tour_next))
            check("Tour Next remains static and render-on-demand", not tour_next["state"]["autoRotate"] and not tour_next["state"]["autoModel"] and not tour_next["state"]["autoColor"] and not tour_next["state"]["softFx"] and not tour_next["metrics"]["runtimeAnimationActive"] and not tour_next["metrics"]["motionActive"], str(tour_next))
            check("Tour step records scene and no saved config change", tour_next["metrics"]["mobileTourNextCount"] > tour_next_before["mobileTourNextCount"] and tour_next["metrics"]["lastMobileTourAction"] == "mobile-tour-next" and tour_next["metrics"]["lastInteractionType"] == "mobile-tour-next" and tour_next["stored"]["modelMode"] == "e8_2d", str(tour_next))
            page.evaluate("() => window.__mobileApp.openSettings('info')")
            tour_open = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                output: document.getElementById('mobile-tour-output').textContent.trim(),
                step: document.getElementById('mobile-tour-step-output').textContent.trim(),
                toggle: document.getElementById('mobile-tour-toggle').textContent.trim(),
                copy: document.getElementById('mobile-tour-copy').innerText
            })""")
            check("Tour card reflects paused active step when reopened", tour_open["metrics"]["settingsOpen"] and tour_open["output"] == "Paused" and tour_open["step"] == "2/6" and tour_open["toggle"] == "Stop" and "Designed Bloom" in tour_open["copy"], str(tour_open))
            check("Tour timer pauses while Info sheet is open", tour_open["metrics"]["mobileTourPausedForSettings"] and not tour_open["metrics"]["mobileTourTimerActive"] and tour_open["metrics"]["mobileTourPauseCount"] >= 1, str(tour_open["metrics"]))
            tour_stop_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("debug back closes settings before stopping tour", page.evaluate("() => window.__mobileApp.handleBackNavigation()"))
            page.evaluate("() => window.__mobileApp.handleBackNavigation()")
            tour_stop = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                tour: window.__mobileApp.getMobileTourState(),
                metrics: window.__mobileApp.getMetrics()
            })""")
            check("Back stops active tour after sheet is closed", not tour_stop["tour"]["active"] and not tour_stop["tour"]["timerActive"] and tour_stop["metrics"]["mobileTourStopCount"] > tour_stop_before["mobileTourStopCount"] and tour_stop["metrics"]["lastMobileTourAction"] == "back-stop-tour" and tour_stop["metrics"]["lastInteractionType"] == "back-stop-tour", str(tour_stop))
            tour_storage_guard = page.evaluate("""() => {
                const app = window.__mobileApp;
                app.setState({
                    modelMode: 'e8_2d',
                    shape: 'icosahedron',
                    polytope4d: '24cell',
                    dynkinDiagram: 'E8',
                    palette: 'gold',
                    autoRotate: false,
                    autoModel: false,
                    autoColor: false,
                    softFx: false,
                    selectedRoot: null
                });
                app.flushSave();
                app.startMobileTour({ schedule: false, status: false, closeSettings: false });
                app.nextMobileTourStep({ schedule: false, status: false });
                const beforePending = app.getMetrics();
                app.setState({ palette: 'cyan' });
                const pending = app.getMetrics();
                app.stopMobileTour({ status: false });
                const afterStop = app.getMetrics();
                const stored = app.getStoredState();
                app.setState({
                    modelMode: 'e8_2d',
                    shape: 'icosahedron',
                    polytope4d: '24cell',
                    dynkinDiagram: 'E8',
                    palette: 'gold',
                    autoRotate: false,
                    autoModel: false,
                    autoColor: false,
                    softFx: false,
                    selectedRoot: null
                });
                app.flushSave();
                return { beforePending, pending, afterStop, stored, state: app.getState() };
            }""")
            check("Tour storage guard saves user setting without tour scene", tour_storage_guard["pending"]["savePending"] and not tour_storage_guard["afterStop"]["savePending"] and tour_storage_guard["afterStop"]["mobileTourStorageGuardFlushCount"] > tour_storage_guard["beforePending"]["mobileTourStorageGuardFlushCount"] and tour_storage_guard["stored"]["palette"] == "cyan" and tour_storage_guard["stored"]["modelMode"] == "e8_2d" and tour_storage_guard["stored"]["autoRotate"] is False and tour_storage_guard["stored"]["autoModel"] is False and tour_storage_guard["stored"]["selectedRoot"] is None, str(tour_storage_guard))
            page.evaluate("""() => {
                const app = window.__mobileApp;
                app.setState({
                    modelMode: 'e8_2d',
                    shape: 'icosahedron',
                    polytope4d: '24cell',
                    dynkinDiagram: 'E8',
                    palette: 'gold',
                    autoRotate: false,
                    autoModel: false,
                    autoColor: false,
                    softFx: false,
                    selectedRoot: null
                });
                app.flushSave();
                app.startMobileTour({ schedule: false, status: false, closeSettings: false });
                app.openSettings('view');
            }""")
            manual_model_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#model-select").evaluate("el => { el.value = 'platonic'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            manual_model_stop = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    modelMode: document.getElementById('model-select').value,
                    shapeHidden: document.getElementById('shape-field').classList.contains('hidden')
                }
            })""")
            check("Manual model select stops active tour", not manual_model_stop["metrics"]["mobileTourActive"] and not manual_model_stop["metrics"]["mobileTourTimerActive"] and manual_model_stop["metrics"]["mobileTourStopCount"] > manual_model_before["mobileTourStopCount"] and manual_model_stop["metrics"]["lastMobileTourAction"] == "mobile-tour-manual-model-stop" and manual_model_stop["metrics"]["lastInteractionType"] == "model-select", str(manual_model_stop))
            check("Manual model select wins over paused tour scene", manual_model_stop["state"]["modelMode"] == "platonic" and manual_model_stop["controls"]["modelMode"] == "platonic" and not manual_model_stop["controls"]["shapeHidden"], str(manual_model_stop))
            page.evaluate("""() => {
                const app = window.__mobileApp;
                app.setState({
                    modelMode: 'e8_2d',
                    shape: 'icosahedron',
                    polytope4d: '24cell',
                    dynkinDiagram: 'E8',
                    autoRotate: false,
                    autoModel: false,
                    autoColor: false,
                    softFx: false,
                    selectedRoot: null
                });
                app.flushSave();
                app.startMobileTour({ schedule: false, status: false, closeSettings: false });
                app.openSettings('style');
            }""")
            manual_runtime_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#fx-preset-grid [data-fx-preset="live"]').click()
            manual_runtime_stop = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    autoColor: document.getElementById('auto-color-toggle').checked,
                    softFx: document.getElementById('soft-fx-toggle').checked,
                    activeFx: document.querySelector('#fx-preset-grid button.active')?.dataset.fxPreset
                }
            })""")
            check("Manual FX preset stops active tour", not manual_runtime_stop["metrics"]["mobileTourActive"] and not manual_runtime_stop["metrics"]["mobileTourTimerActive"] and manual_runtime_stop["metrics"]["mobileTourStopCount"] > manual_runtime_before["mobileTourStopCount"] and manual_runtime_stop["metrics"]["lastMobileTourAction"] == "mobile-tour-manual-runtime-stop" and manual_runtime_stop["metrics"]["lastInteractionType"] == "fx-preset-live", str(manual_runtime_stop))
            check("Manual FX preset wins over tour static mode", manual_runtime_stop["state"]["autoColor"] and manual_runtime_stop["state"]["softFx"] and manual_runtime_stop["controls"]["autoColor"] and manual_runtime_stop["controls"]["softFx"] and manual_runtime_stop["controls"]["activeFx"] == "live", str(manual_runtime_stop))
            page.evaluate("""() => {
                const app = window.__mobileApp;
                app.setState({
                    modelMode: 'e8_2d',
                    shape: 'icosahedron',
                    polytope4d: '24cell',
                    dynkinDiagram: 'E8',
                    autoRotate: false,
                    autoModel: false,
                    autoColor: false,
                    softFx: false,
                    selectedRoot: null
                });
                app.flushSave();
                app.startMobileTour({ schedule: false, status: false, closeSettings: false });
                app.openSettings('info');
            }""")
            manual_explore_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#cartan-matrix [data-cartan-root="3"]').first.click()
            manual_explore_stop = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                info: document.getElementById('info-selection').innerText
            })""")
            check("Manual root exploration stops active tour", not manual_explore_stop["metrics"]["mobileTourActive"] and not manual_explore_stop["metrics"]["mobileTourTimerActive"] and manual_explore_stop["metrics"]["mobileTourStopCount"] > manual_explore_before["mobileTourStopCount"] and manual_explore_stop["metrics"]["lastMobileTourAction"] == "mobile-tour-manual-explore-stop" and manual_explore_stop["metrics"]["lastInteractionType"] == "cartan-matrix-select", str(manual_explore_stop))
            check("Manual root exploration wins over tour scene", manual_explore_stop["state"]["selectedRoot"] == 1 and manual_explore_stop["state"]["subset"] == "simple_roots" and "Root #1 (alpha 3)" in manual_explore_stop["info"], str(manual_explore_stop))
            page.evaluate("""() => {
                const app = window.__mobileApp;
                app.setState({
                    modelMode: 'e8_2d',
                    shape: 'icosahedron',
                    polytope4d: '24cell',
                    dynkinDiagram: 'E8',
                    autoRotate: false,
                    autoModel: false,
                    autoColor: false,
                    softFx: false,
                    selectedRoot: null,
                    subset: 'icosahedron',
                    zoom: 1,
                    panX: 0,
                    panY: 0
                });
                app.flushSave();
                app.startMobileTour({ schedule: false, status: false, closeSettings: false });
                app.openSettings('view');
            }""")
            manual_view_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('[data-action="reset-view"]').click()
            manual_view_stop = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics()
            })""")
            check("Manual view action stops active tour", not manual_view_stop["metrics"]["mobileTourActive"] and not manual_view_stop["metrics"]["mobileTourTimerActive"] and manual_view_stop["metrics"]["mobileTourStopCount"] > manual_view_before["mobileTourStopCount"] and manual_view_stop["metrics"]["lastMobileTourAction"] == "mobile-tour-manual-explore-stop" and manual_view_stop["metrics"]["lastInteractionType"] == "reset-view", str(manual_view_stop))
            page.evaluate("() => { window.__mobileApp.selectModelShortcut('e8_2d'); window.__mobileApp.openSettings('info'); }")
            cartan_select_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#cartan-matrix [data-cartan-root="3"]').first.click()
            cartan_select = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                info: document.getElementById('info-selection').innerText,
                curiosity: document.getElementById('curiosity-card').innerText,
                subsetLabel: document.getElementById('subset-output').textContent,
                subsetValue: document.getElementById('subset-select').value
            })""")
            check("Cartan matrix alpha header selects root", cartan_select["state"]["selectedRoot"] == 1 and cartan_select["metrics"]["selectedContext"]["simpleRootLabel"] == "alpha 3" and "Root #1 (alpha 3)" in cartan_select["info"], str(cartan_select))
            check("Context note reacts to selected root", cartan_select["metrics"]["lastCuriosityTitle"] == "Root neighborhood" and "Root #1" in cartan_select["curiosity"] and "Cartan-edge neighbors" in cartan_select["curiosity"], str(cartan_select))
            check("Cartan matrix select switches to simple-root context", cartan_select["state"]["subset"] == "simple_roots" and cartan_select["subsetValue"] == "simple_roots" and cartan_select["subsetLabel"] == "3/8" and cartan_select["metrics"]["subsetIndex"] == 2, str(cartan_select))
            check("Cartan matrix select uses lightweight Settings path", cartan_select["metrics"]["cartanMatrixSelectCount"] > cartan_select_before["cartanMatrixSelectCount"] and cartan_select["metrics"]["lastCartanMatrixSelectRoot"] == 1 and cartan_select["metrics"]["lastCartanMatrixSelectOrder"] == 3 and cartan_select["metrics"]["cartanMatrixSubsetSwitchCount"] > cartan_select_before["cartanMatrixSubsetSwitchCount"] and cartan_select["metrics"]["subsetControlSyncCount"] > cartan_select_before["subsetControlSyncCount"] and cartan_select["metrics"]["controlSyncCount"] == cartan_select_before["controlSyncCount"], str(cartan_select["metrics"]))
            check("Cartan matrix select defers hidden render", cartan_select["metrics"]["settingsDeferredRenderRequestCount"] > cartan_select_before["settingsDeferredRenderRequestCount"] and cartan_select["metrics"]["lastSettingsDeferredRenderReason"] == "cartan-matrix-select" and cartan_select["metrics"]["renderCount"] == cartan_select_before["renderCount"], str(cartan_select["metrics"]))
            snapshot_button = page.locator("#share-png").bounding_box()
            check("Info section exposes compact snapshot action", bool(snapshot_button) and snapshot_button["height"] >= 40, str(snapshot_button))
            snapshot_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            snapshot_result = page.evaluate("() => window.__mobileApp.shareSnapshot({ share: false, download: false })")
            snapshot_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("snapshot prepare returns PNG metadata", snapshot_result["ok"] and snapshot_result["mode"] == "prepared" and snapshot_result["bytes"] > 10000 and snapshot_result["width"] == snapshot_after["canvas"]["width"] and snapshot_result["height"] == snapshot_after["canvas"]["height"], str(snapshot_result))
            check("snapshot prepare records lightweight export metrics", snapshot_after["snapshotShareSuccessCount"] > snapshot_before["snapshotShareSuccessCount"] and snapshot_after["snapshotShareFallbackCount"] == snapshot_before["snapshotShareFallbackCount"] and snapshot_after["snapshotShareErrorCount"] == snapshot_before["snapshotShareErrorCount"] and snapshot_after["lastSnapshotShareMode"] == "prepared" and snapshot_after["lastInteractionType"] == "share-png", str(snapshot_after))
            check("snapshot prepare renders latest hidden canvas state", snapshot_after["renderCount"] > snapshot_before["renderCount"] and not snapshot_after["settingsDeferredRenderPending"], str(snapshot_after))
            postcard_button = page.locator("#share-postcard").bounding_box()
            check("Info section exposes compact postcard action", bool(postcard_button) and postcard_button["height"] >= 40, str(postcard_button))
            postcard_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            postcard_result = page.evaluate("() => window.__mobileApp.sharePostcard({ share: false, download: false })")
            postcard_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("postcard prepare returns 9:16 PNG metadata", postcard_result["ok"] and postcard_result["mode"] == "prepared" and postcard_result["bytes"] > 30000 and postcard_result["width"] == 1080 and postcard_result["height"] == 1920 and "Root #1" in postcard_result["caption"] and "E8 Coxeter" in postcard_result["scene"], str(postcard_result))
            check("postcard prepare records export metrics", postcard_after["postcardShareSuccessCount"] > postcard_before["postcardShareSuccessCount"] and postcard_after["postcardShareFallbackCount"] == postcard_before["postcardShareFallbackCount"] and postcard_after["postcardShareErrorCount"] == postcard_before["postcardShareErrorCount"] and postcard_after["lastPostcardShareMode"] == "prepared" and postcard_after["lastPostcardShareWidth"] == 1080 and postcard_after["lastPostcardShareHeight"] == 1920 and postcard_after["lastInteractionType"] == "share-postcard", str(postcard_after))
            check("postcard prepare renders latest hidden canvas state", postcard_after["renderCount"] > postcard_before["renderCount"] and not postcard_after["settingsDeferredRenderPending"], str(postcard_after))
            diagnostics_button = page.locator("#copy-diagnostics").bounding_box()
            check("Info section exposes compact diagnostics action", bool(diagnostics_button) and diagnostics_button["height"] >= 40, str(diagnostics_button))
            diagnostics_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            diagnostics_result = page.evaluate("() => window.__mobileApp.copyDiagnostics({ copy: false, download: false })")
            diagnostics_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("diagnostics prepare returns renderer and device state", diagnostics_result["ok"] and diagnostics_result["mode"] == "prepared" and diagnostics_result["bytes"] > 1000 and diagnostics_result["diagnostics"]["renderer"]["type"] == "canvas2d" and diagnostics_result["diagnostics"]["state"]["view"] == "e8coxeter" and diagnostics_result["diagnostics"]["device"]["viewport"]["width"] == 390, str(diagnostics_result))
            check("diagnostics prepare records export metrics", diagnostics_after["diagnosticsCopySuccessCount"] > diagnostics_before["diagnosticsCopySuccessCount"] and diagnostics_after["diagnosticsCopyFallbackCount"] == diagnostics_before["diagnosticsCopyFallbackCount"] and diagnostics_after["diagnosticsCopyErrorCount"] == diagnostics_before["diagnosticsCopyErrorCount"] and diagnostics_after["lastDiagnosticsCopyMode"] == "prepared" and diagnostics_after["lastInteractionType"] == "copy-diagnostics", str(diagnostics_after))
            data_button = page.locator("#copy-data").bounding_box()
            check("Info section exposes compact geometry data action", bool(data_button) and data_button["height"] >= 40, str(data_button))
            data_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            data_result = page.evaluate("() => window.__mobileApp.copyModelData({ copy: false, download: false })")
            data_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("geometry data prepare returns E8 canonical roots", data_result["ok"] and data_result["mode"] == "prepared" and data_result["geometry"]["kind"] == "e8-root-system" and data_result["geometry"]["dimension"] == 8 and len(data_result["geometry"]["roots8d"]) == 240 and len(data_result["geometry"]["coxeter_projection_2d"]) == 240 and len(data_result["geometry"]["active_subset"]["indices"]) == 8, str(data_result["geometry"].keys()))
            check("geometry data prepare records export metrics", data_after["modelDataExportSuccessCount"] > data_before["modelDataExportSuccessCount"] and data_after["modelDataExportFallbackCount"] == data_before["modelDataExportFallbackCount"] and data_after["modelDataExportErrorCount"] == data_before["modelDataExportErrorCount"] and data_after["lastModelDataExportMode"] == "prepared" and data_after["lastModelDataExportKind"] == "e8-root-system" and data_after["lastInteractionType"] == "copy-data" and data_after["renderCount"] == data_before["renderCount"], str(data_after))
            obj_button = page.locator("#copy-obj").bounding_box()
            check("Info section exposes compact OBJ action", bool(obj_button) and obj_button["height"] >= 40, str(obj_button))
            obj_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            obj_result = page.evaluate("() => window.__mobileApp.copyModelObj({ copy: false, download: false })")
            obj_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("OBJ prepare returns E8 point cloud", obj_result["ok"] and obj_result["mode"] == "prepared" and obj_result["obj"]["kind"] == "e8-root-point-cloud-2d-obj" and obj_result["obj"]["vertices"] == 240 and obj_result["obj"]["points"] == 240 and obj_result["obj"]["faces"] == 0 and obj_result["obj"]["text"].startswith("# E8 Studio Mobile V2 OBJ"), str(obj_result["obj"]))
            check("OBJ prepare records export metrics", obj_after["modelObjExportSuccessCount"] > obj_before["modelObjExportSuccessCount"] and obj_after["modelObjExportFallbackCount"] == obj_before["modelObjExportFallbackCount"] and obj_after["modelObjExportErrorCount"] == obj_before["modelObjExportErrorCount"] and obj_after["lastModelObjExportMode"] == "prepared" and obj_after["lastModelObjExportKind"] == "e8-root-point-cloud-2d-obj" and obj_after["lastInteractionType"] == "copy-obj" and obj_after["renderCount"] == obj_before["renderCount"], str(obj_after))
            page.evaluate("() => { window.__mobileApp.setState({ selectedRoot: null, subset: 'icosahedron' }); window.__mobileApp.flushSave(); }")

            page.evaluate(
                """() => {
                    window.__mobileApp.openSettings('view');
                    const body = document.querySelector('.sheet-body');
                    body.scrollTop = body.scrollHeight;
                }"""
            )
            scrolled_view = page.evaluate("() => document.querySelector('.sheet-body').scrollTop")
            check("View settings body can scroll", scrolled_view > 0, str(scrolled_view))
            page.get_by_role("button", name="Done", exact=True).click()
            done_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("View Done closes scrolled settings", not done_metrics["settingsOpen"] and done_metrics["lastInteractionType"] == "settings-done", str(done_metrics))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.get_by_role("button", name="Visuals", exact=True).click()
            style_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("section switch resets settings scroll", style_metrics["settingsSection"] == "style" and style_metrics["settingsScrollTop"] == 0, str(style_metrics))
            page.evaluate("""() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))""")
            escape_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Escape closes settings sheet", not escape_metrics["settingsOpen"] and escape_metrics["lastInteractionType"] == "back-close-settings", str(escape_metrics))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            check("debug back closes settings sheet", page.evaluate("() => window.__mobileApp.handleBackNavigation()"))
            check("settings is closed after debug back", not page.evaluate("() => window.__mobileApp.getMetrics().settingsOpen"))
            page.evaluate("() => window.__mobileApp.selectRoot(5)")
            check("drawer is visible before back clear", page.locator("#root-drawer:not(.hidden)").count() == 1)
            check("debug back clears selected root drawer", page.evaluate("() => window.__mobileApp.handleBackNavigation()"))
            back_clear_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("selected root cleared by debug back", back_clear_metrics["selectedRoot"] is None and back_clear_metrics["lastInteractionType"] == "back-clear-selection", str(back_clear_metrics))
            check("back handler falls through with no layer", page.evaluate("() => window.__mobileApp.handleBackNavigation()") is False)
            page.evaluate("() => window.__mobileApp.openSettings('style')")

            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    canvas.dispatchEvent(new PointerEvent('pointerdown', {
                        bubbles: true,
                        pointerId: 101,
                        pointerType: 'touch',
                        clientX: 180,
                        clientY: 430,
                        isPrimary: true,
                    }));
                }"""
            )
            page.wait_for_function("() => Number(getComputedStyle(document.querySelector('.topbar')).opacity) < 0.5")
            stuck_metrics = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                shellFaded: document.querySelector('.mobile-shell').classList.contains('is-interacting'),
                topbarOpacity: Number(getComputedStyle(document.querySelector('.topbar')).opacity)
            })""")
            check("synthetic stuck pointer starts interaction", stuck_metrics["metrics"]["interactionActive"] and stuck_metrics["metrics"]["pointerCount"] == 1, str(stuck_metrics))
            check("active stuck pointer fades chrome", stuck_metrics["metrics"]["chromeFaded"] and stuck_metrics["shellFaded"] and stuck_metrics["topbarOpacity"] < 0.5 and stuck_metrics["metrics"]["chromeFadeInCount"] >= 1, str(stuck_metrics))
            page.evaluate("() => window.dispatchEvent(new Event('resize'))")
            page.wait_for_function("() => Number(getComputedStyle(document.querySelector('.topbar')).opacity) > 0.9")
            reset_metrics = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                shellFaded: document.querySelector('.mobile-shell').classList.contains('is-interacting'),
                topbarOpacity: Number(getComputedStyle(document.querySelector('.topbar')).opacity)
            })""")
            check("viewport change clears stuck input", not reset_metrics["metrics"]["interactionActive"] and reset_metrics["metrics"]["pointerCount"] == 0 and reset_metrics["metrics"]["lastInteractionType"] == "viewport-change", str(reset_metrics))
            check("viewport reset restores chrome", not reset_metrics["metrics"]["chromeFaded"] and not reset_metrics["shellFaded"] and reset_metrics["topbarOpacity"] > 0.9 and reset_metrics["metrics"]["chromeFadeOutCount"] >= 1 and reset_metrics["metrics"]["lastChromeFadeReason"] == "viewport-change", str(reset_metrics))
            page.evaluate("() => { window.__mobileApp.fitAllRoots(); window.__mobileApp.forceRender(); window.__mobileApp.hideStatus(); window.__mobileApp.flushSave(); }")
            viewport_fit_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("pre-resize all roots are fitted", viewport_fit_before["allFrame"]["withinView"], str(viewport_fit_before["allFrame"]))
            page.set_viewport_size({"width": 340, "height": 720})
            page.wait_for_function("() => window.__mobileApp.getMetrics().viewport.width === 340")
            page.wait_for_function("count => window.__mobileApp.getMetrics().viewportChangeCount > count", arg=viewport_fit_before["viewportChangeCount"])
            page.evaluate("() => window.__mobileApp.forceRender()")
            viewport_fit_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("viewport resize refits fitted all-roots view", viewport_fit_after["allFrame"]["withinView"] and viewport_fit_after["viewportFitCount"] > viewport_fit_before["viewportFitCount"], str(viewport_fit_after))
            check("viewport refit is silent", not viewport_fit_after["statusVisible"], str(viewport_fit_after))
            errors_before_tiny = len(viewport_fit_after["runtimeErrors"])
            viewport_count_before_tiny = viewport_fit_after["viewportChangeCount"]
            page.set_viewport_size({"width": 20, "height": 620})
            page.wait_for_function("() => window.__mobileApp.getMetrics().viewport.width === 20")
            page.wait_for_function("count => window.__mobileApp.getMetrics().viewportChangeCount > count", arg=viewport_count_before_tiny)
            page.evaluate("() => window.__mobileApp.forceRender()")
            tiny_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("tiny transient viewport does not add runtime errors", len(tiny_metrics["runtimeErrors"]) == errors_before_tiny, str(tiny_metrics["runtimeErrors"]))
            check("tiny transient viewport keeps ring draw valid", tiny_metrics["lastDrawStats"]["rings"] == 8 and tiny_metrics["lastDrawStats"]["ringStrokes"] == 1, str(tiny_metrics["lastDrawStats"]))
            page.set_viewport_size({"width": 390, "height": 844})
            page.wait_for_function("() => window.__mobileApp.getMetrics().viewport.width === 390")
            page.wait_for_function("count => window.__mobileApp.getMetrics().viewportChangeCount > count", arg=tiny_metrics["viewportChangeCount"])
            legacy_depth_mode = page.evaluate("() => { window.__mobileApp.setState({ modelMode: 'e8_2d' }); return window.__mobileApp.setState({ modelMode: 'e8_3d' }).modelMode; }")
            check("legacy E8 3D state migrates to Bloom", legacy_depth_mode == "bloom", str(legacy_depth_mode))
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.setState({ modelMode: 'bloom', bloomAmount: 0, bloomAuto: false, bloomTwinH4: true, selectedRoot: null, autoRotate: false }); window.__mobileApp.forceRender(); }")
            bloom_source_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Bloom begins as the source solid instead of a line mash", bloom_source_metrics["lastModelMode"] == "bloom" and bloom_source_metrics["lastDrawStats"]["bloomPhase"] == "Shape" and bloom_source_metrics["lastDrawStats"]["bloomVisiblePoints"] == 12 and bloom_source_metrics["lastDrawStats"]["modelProjectedVertices"] == 12 and bloom_source_metrics["lastDrawStats"]["bloomSourceEdges"] == 30 and bloom_source_metrics["lastDrawStats"]["bloomTwinTrails"] == 0 and bloom_source_metrics["lastDrawStats"]["modelEdges"] == 30 and bloom_source_metrics["lastProjectionSource"] == "bloom-depth-points", str(bloom_source_metrics["lastDrawStats"]))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            bloom_controls = page.evaluate("""() => ({
                visible: !document.getElementById('bloom-timeline-field').classList.contains('hidden'),
                value: document.getElementById('bloom-time').value,
                time: document.getElementById('bloom-time-output').textContent,
                phase: document.getElementById('bloom-phase-output').textContent,
                auto: document.getElementById('bloom-auto-button').textContent,
                twinPressed: document.getElementById('bloom-twin-button').getAttribute('aria-pressed'),
                timelineTop: document.getElementById('bloom-timeline-field').getBoundingClientRect().top,
                modelsTop: document.querySelector('.model-shortcut-panel').getBoundingClientRect().top
            })""")
            check("View exposes the Bloom timeline controls above Models", bloom_controls["visible"] and bloom_controls["value"] == "0" and bloom_controls["time"] == "0.00" and bloom_controls["phase"] == "Shape" and bloom_controls["auto"] == "Auto" and bloom_controls["twinPressed"] == "true" and bloom_controls["timelineTop"] < bloom_controls["modelsTop"], str(bloom_controls))
            page.locator("#bloom-time").evaluate("el => { el.value = '0.65'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }")
            bloom_scrub = page.evaluate("() => ({ state: window.__mobileApp.getState(), time: document.getElementById('bloom-time-output').textContent, phase: document.getElementById('bloom-phase-output').textContent })")
            check("Bloom timeline scrubs and labels the twin phase", abs(bloom_scrub["state"]["bloomAmount"] - 0.65) < 0.001 and not bloom_scrub["state"]["bloomAuto"] and bloom_scrub["time"] == "0.65" and bloom_scrub["phase"] == "Twin H4", str(bloom_scrub))
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); }")
            bloom_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Bloom twin phase renders structured H4 layers with only correspondence trails", bloom_metrics["lastModelMode"] == "bloom" and bloom_metrics["lastDrawStats"]["modelProjectedVertices"] == 240 and bloom_metrics["lastDrawStats"]["points"] == 240 and bloom_metrics["lastDrawStats"]["bloomFirstCellPoints"] == 120 and bloom_metrics["lastDrawStats"]["bloomTwinPoints"] == 120 and bloom_metrics["lastDrawStats"]["bloomTwinTrails"] == 12 and bloom_metrics["lastDrawStats"]["modelEdges"] == 12 and bloom_metrics["lastDrawStats"]["modelEdgeStrokes"] == 1 and bloom_metrics["e8Projection3DCount"] >= 1 and bloom_metrics["bloomDrawCount"] >= 1 and bloom_metrics["lastProjectionSource"] == "bloom-depth-points", str(bloom_metrics["lastDrawStats"]))
            bloom_labels = page.evaluate("""() => ({
                topbar: document.querySelector('.topbar').getAttribute('aria-label'),
                canvas: document.getElementById('mobile-canvas').getAttribute('aria-label'),
                info: document.getElementById('info-copy').textContent,
                metrics: window.__mobileApp.getMetrics()
            })""")
            check("Bloom labels describe the construction timeline", "Designed Bloom timeline" in bloom_labels["topbar"] and "Twin H4 phase" in bloom_labels["canvas"] and "600-cell and twin H4 stages" in bloom_labels["info"] and bloom_labels["metrics"]["lastInfoCopy"] == bloom_labels["info"], str(bloom_labels))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.locator("#bloom-twin-button").click()
            twin_off = page.evaluate("() => ({ state: window.__mobileApp.getState(), pressed: document.getElementById('bloom-twin-button').getAttribute('aria-pressed') })")
            check("Twin H4 control toggles the layer contrast", not twin_off["state"]["bloomTwinH4"] and twin_off["pressed"] == "false", str(twin_off))
            page.locator("#bloom-twin-button").click()
            page.locator("#bloom-auto-button").click()
            bloom_auto_armed = page.evaluate("() => ({ state: window.__mobileApp.getState(), text: document.getElementById('bloom-auto-button').textContent, metrics: window.__mobileApp.getMetrics() })")
            check("Bloom Auto control arms as Pause", bloom_auto_armed["state"]["bloomAuto"] and bloom_auto_armed["state"]["bloomTwinH4"] and bloom_auto_armed["text"] == "Pause", str(bloom_auto_armed))
            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.wait_for_function("before => window.__mobileApp.getMetrics().bloomAutoFrameCount > before", arg=bloom_auto_armed["metrics"]["bloomAutoFrameCount"], timeout=1500)
            bloom_auto_running = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("Bloom Auto advances the timeline through the motion loop", bloom_auto_running["state"]["bloomAmount"] > 0.65 and bloom_auto_running["metrics"]["motionActive"] and bloom_auto_running["metrics"]["bloomAutoFrameCount"] > bloom_auto_armed["metrics"]["bloomAutoFrameCount"], str(bloom_auto_running))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.locator('[data-bloom-action="reset"]').click()
            bloom_reset = page.evaluate("() => ({ state: window.__mobileApp.getState(), time: document.getElementById('bloom-time-output').textContent, phase: document.getElementById('bloom-phase-output').textContent, auto: document.getElementById('bloom-auto-button').textContent })")
            check("Bloom Reset restores the source and pauses animation", bloom_reset["state"]["bloomAmount"] == 0 and not bloom_reset["state"]["bloomAuto"] and bloom_reset["time"] == "0.00" and bloom_reset["phase"] == "Shape" and bloom_reset["auto"] == "Auto", str(bloom_reset))
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.setState({ bloomAmount: 1 }); window.__mobileApp.forceRender(); }")
            bloom_coxeter = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Bloom ends on all 240 Coxeter-plane roots", bloom_coxeter["lastDrawStats"]["bloomPhase"] == "Coxeter" and bloom_coxeter["lastDrawStats"]["bloomVisiblePoints"] == 240 and bloom_coxeter["lastDrawStats"]["bloomPhase2D"] == 1 and bloom_coxeter["lastDrawStats"]["modelEdges"] == 0, str(bloom_coxeter["lastDrawStats"]))
            bloom_obj = page.evaluate("() => window.__mobileApp.copyModelObj({ copy: false, download: false })")
            check("OBJ export follows Bloom's underlying root cloud", bloom_obj["ok"] and bloom_obj["obj"]["kind"] == "e8-root-point-cloud-3d-obj" and bloom_obj["obj"]["name"] == "e8-designed-bloom" and bloom_obj["obj"]["vertices"] == 240 and bloom_obj["obj"]["points"] == 240 and "# kind: e8-root-point-cloud-3d-obj" in bloom_obj["obj"]["text"], str(bloom_obj["obj"]))
            page.evaluate("() => { window.__mobileApp.setState({ modelMode: 'sdf', selectedRoot: 7, autoRotate: false }); window.__mobileApp.forceRender(); }")
            sdf_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("SDF renders a high-resolution 240-root ray-marched surface", sdf_metrics["lastModelMode"] == "sdf" and sdf_metrics["selectedRoot"] is None and sdf_metrics["renderScale"] >= 1 and sdf_metrics["lastDrawStats"]["sdfSpheres"] == 240 and sdf_metrics["lastDrawStats"]["sdfRasterSize"] >= 300 and sdf_metrics["lastDrawStats"]["sdfPixels"] > 200000 and sdf_metrics["lastDrawStats"]["sdfRenderer"] == "webgl-raymarch" and sdf_metrics["lastDrawStats"]["sdfMarchSteps"] >= 40 and sdf_metrics["lastDrawStats"]["modelFaceFills"] == 1 and sdf_metrics["sdfDrawCount"] >= 1 and sdf_metrics["lastProjectionSource"] == "sdf-webgl-raymarch", str(sdf_metrics["lastDrawStats"]))
            sdf_controls = page.evaluate("""() => ({
                visible: !document.getElementById('sdf-field').classList.contains('hidden'),
                radius: document.getElementById('sdf-radius-output').textContent,
                blend: document.getElementById('sdf-blend-output').textContent,
                bloom: document.getElementById('sdf-bloom-output').textContent,
                aniso: document.getElementById('sdf-aniso-output').textContent,
                overlayActive: document.getElementById('mobile-sdf-canvas').classList.contains('active')
            })""")
            check("SDF exposes desktop-style surface tuning", sdf_controls["visible"] and sdf_controls["radius"] == "0.080" and sdf_controls["blend"] == "0.030" and sdf_controls["bloom"] == "50%" and sdf_controls["aniso"] == "60%" and sdf_controls["overlayActive"], str(sdf_controls))
            sdf_quality_profiles = []
            for sdf_quality in ["balanced", "sharp"]:
                page.evaluate("quality => { window.__mobileApp.setState({ quality }); window.__mobileApp.forceRender(); }", sdf_quality)
                sdf_quality_profiles.append(page.evaluate("() => window.__mobileApp.getMetrics().lastDrawStats"))
            check("SDF quality tiers compile distinct seam-free raymarch budgets", sdf_quality_profiles[0]["sdfRenderer"] == "webgl-raymarch" and sdf_quality_profiles[0]["sdfQuality"] == "balanced" and sdf_quality_profiles[0]["sdfMarchSteps"] == 48 and sdf_quality_profiles[0]["sdfNeighborSpan"] == 1 and sdf_quality_profiles[0]["sdfShadowSteps"] == 0 and sdf_quality_profiles[0]["sdfAoSteps"] == 0 and sdf_quality_profiles[1]["sdfRenderer"] == "webgl-raymarch" and sdf_quality_profiles[1]["sdfQuality"] == "sharp" and sdf_quality_profiles[1]["sdfMarchSteps"] == 60 and sdf_quality_profiles[1]["sdfNeighborSpan"] == 1 and sdf_quality_profiles[1]["sdfShadowSteps"] == 0 and sdf_quality_profiles[1]["sdfAoSteps"] == 0 and sdf_quality_profiles[1]["sdfRasterSize"] > sdf_quality_profiles[0]["sdfRasterSize"] and sdf_quality_profiles[1]["sdfStaticPixelBoost"] >= 1 and sdf_quality_profiles[1]["sdfRasterScale"] > sdf_quality_profiles[0]["sdfRasterScale"], str(sdf_quality_profiles))
            page.evaluate("() => window.__mobileApp.setState({ quality: 'sharp', autoRotate: true, cameraPath: 'orbit' })")
            page.wait_for_timeout(120)
            sdf_motion = page.evaluate("() => window.__mobileApp.getMetrics().lastDrawStats")
            check("SDF motion retains seam-free sampling and a full-resolution baseline", sdf_motion["sdfQuality"] == "motion" and sdf_motion["sdfMarchSteps"] == 38 and sdf_motion["sdfNeighborSpan"] == 1 and sdf_motion["sdfRasterScale"] >= 1.15 and sdf_motion["sdfMotionPixelBoost"] >= 1.15 and sdf_motion["sdfRasterSize"] >= 440 and sdf_motion["sdfPixels"] > 450000, str(sdf_motion))
            page.evaluate("() => { window.__mobileApp.setState({ autoRotate: false, cameraPath: 'manual' }); window.__mobileApp.forceRender(); }")
            page.evaluate("() => { window.__mobileApp.setState({ quality: 'sharp', palette: 'magma', background: 'plasma', backgroundBrightness: 1.1, showRings: false, showContext: false, showPetrie: true, showMirrors: true, highlightSubset: false, pointScale: 1.6, pointOpacity: 0.4, autoColor: true, softFx: true, fxMode: 'heat', fxStrength: 1.4, sdfSphereR: 0.12, sdfBlend: 0.08, sdfBloom: 0.9, sdfAniso: 0.95, rotation: 1.1, cameraTilt: 0.8, cameraPath: 'dive', autoRotate: true, e8MorphT: 0.72, zoom: 2.7, panX: 135, panY: -95 }); window.__mobileApp.openSettings('view'); }")
            page.locator('[data-action="reset-view"]').click()
            page.evaluate("() => window.__mobileApp.forceRender()")
            sdf_reset = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                feedback: {
                    text: document.querySelector('[data-action="reset-view"]').textContent.trim(),
                    confirmed: document.querySelector('[data-action="reset-view"]').classList.contains('is-confirmed')
                }
            })""")
            check("Reset gives persistent visual confirmation", sdf_reset["feedback"]["confirmed"] and sdf_reset["feedback"]["text"] == "Reset done", str(sdf_reset["feedback"]))
            check("SDF Reset restores all visuals while preserving the selected model", sdf_reset["state"]["modelMode"] == "sdf" and sdf_reset["state"]["palette"] == "gold" and sdf_reset["state"]["background"] == "void" and sdf_reset["state"]["quality"] == "smooth" and sdf_reset["state"]["showRings"] and sdf_reset["state"]["showContext"] and not sdf_reset["state"]["showPetrie"] and not sdf_reset["state"]["showMirrors"] and sdf_reset["state"]["highlightSubset"] and sdf_reset["state"]["pointScale"] == 1 and abs(sdf_reset["state"]["pointOpacity"] - 0.72) < 0.001 and not sdf_reset["state"]["autoColor"] and not sdf_reset["state"]["softFx"] and sdf_reset["state"]["fxMode"] == "none" and abs(sdf_reset["state"]["sdfSphereR"] - 0.08) < 0.001 and abs(sdf_reset["state"]["sdfBlend"] - 0.03) < 0.001 and abs(sdf_reset["state"]["rotation"]) < 0.001 and abs(sdf_reset["state"]["cameraTilt"] - 0.28) < 0.001 and sdf_reset["state"]["cameraPath"] == "manual" and not sdf_reset["state"]["autoRotate"] and sdf_reset["state"]["e8MorphT"] == 0 and sdf_reset["state"]["zoom"] == 1 and sdf_reset["state"]["panX"] == 0 and sdf_reset["state"]["panY"] == 0 and sdf_reset["metrics"]["lastRenderAllFrame"]["withinView"] and sdf_reset["metrics"]["lastInteractionType"] == "reset-view", str(sdf_reset))
            page.evaluate("() => window.__mobileApp.setState({ modelMode: 'poly4d', polytope4d: '120cell', palette: 'neon', background: 'vortex', quality: 'sharp', showVertices: true, rotation: 0.7, zoom: 2.2 })")
            page.locator('[data-action="reset-view"]').click()
            poly4d_reset = page.evaluate("() => window.__mobileApp.getState()")
            check("Reset preserves the active 4D selection while clearing its presentation", poly4d_reset["modelMode"] == "poly4d" and poly4d_reset["polytope4d"] == "120cell" and poly4d_reset["palette"] == "gold" and poly4d_reset["background"] == "void" and poly4d_reset["quality"] == "smooth" and not poly4d_reset["showVertices"] and poly4d_reset["rotation"] == 0 and poly4d_reset["zoom"] == 1, str(poly4d_reset))
            page.evaluate("() => { window.__mobileApp.setState({ modelMode: 'sdf', rotation: 0.9, cameraTilt: 0.65, cameraPath: 'dive', autoRotate: true, e8MorphT: 0.9, zoom: 2.9, panX: -160, panY: 120 }); window.__mobileApp.forceRender(); }")
            sdf_dirty_frame = page.evaluate("() => window.__mobileApp.getMetrics().lastRenderAllFrame")
            check("SDF dirty camera begins outside the usable view", not sdf_dirty_frame["withinView"], str(sdf_dirty_frame))
            page.evaluate("() => window.__mobileApp.fitAllRoots()")
            page.evaluate("() => window.__mobileApp.forceRender()")
            sdf_fit = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("SDF framing engine uses ray-marched bounds and stops the moving camera", sdf_fit["metrics"]["lastRenderAllFrame"]["withinView"] and sdf_fit["state"]["cameraPath"] == "manual" and not sdf_fit["state"]["autoRotate"] and abs(sdf_fit["state"]["panX"]) < 0.001 and abs(sdf_fit["state"]["panY"]) < 0.001 and sdf_fit["state"]["zoom"] < 1.1 and sdf_fit["metrics"]["lastInteractionType"] == "fit-all", str(sdf_fit))
            page.locator('[data-action="reset-view"]').click()
            page.evaluate("() => window.__mobileApp.closeSettings()")
            sdf_snapshot = page.evaluate("() => window.__mobileApp.shareSnapshot({ share: false, download: false })")
            check("SDF snapshot composites WebGL over the mobile background", sdf_snapshot["ok"] and sdf_snapshot["bytes"] > 10000 and sdf_snapshot["width"] == 390 and sdf_snapshot["height"] == 844, str(sdf_snapshot))
            sdf_labels = page.evaluate("""() => ({
                topbar: document.querySelector('.topbar').getAttribute('aria-label'),
                canvas: document.getElementById('mobile-canvas').getAttribute('aria-label'),
                info: document.getElementById('info-copy').textContent,
                metrics: window.__mobileApp.getMetrics()
            })""")
            check("SDF labels describe the faithful implicit renderer", "E8 SDF" in sdf_labels["topbar"] and "240 smoothly joined root spheres" in sdf_labels["topbar"] and "signed-distance-field" in sdf_labels["canvas"] and "all 240 Coxeter-plane root spheres" in sdf_labels["info"] and sdf_labels["metrics"]["lastInfoCopy"] == sdf_labels["info"], str(sdf_labels))
            sdf_obj = page.evaluate("() => window.__mobileApp.copyModelObj({ copy: false, download: false })")
            check("OBJ export follows SDF's Coxeter-plane sphere centres", sdf_obj["ok"] and sdf_obj["obj"]["kind"] == "e8-root-point-cloud-2d-obj" and sdf_obj["obj"]["name"] == "e8-distance-field" and sdf_obj["obj"]["vertices"] == 240 and sdf_obj["obj"]["points"] == 240 and "centres underlying the mobile SDF" in sdf_obj["obj"]["text"], str(sdf_obj["obj"]))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.locator("#model-select").evaluate("el => { el.value = 'platonic'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            model_select_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("model selector switches to Platonic controls", page.locator("#shape-field:not(.hidden)").count() == 1 and model_select_metrics["settingsControlSyncSkipCount"] > 0 and model_select_metrics["selectedRoot"] is None, str(model_select_metrics))
            page.locator("#shape-select").evaluate("el => { el.value = 'dodecahedron'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); }")
            platonic_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Platonic dodecahedron renders twelve solid hull faces with occluded rear edges", platonic_metrics["lastModelMode"] == "platonic" and platonic_metrics["lastShape"] == "dodecahedron" and platonic_metrics["lastDrawStats"]["modelVertices"] == 20 and platonic_metrics["lastDrawStats"]["modelEdges"] == 30 and platonic_metrics["lastDrawStats"]["modelFaces"] == 12 and platonic_metrics["lastDrawStats"]["modelFaceFills"] == 12 and 0 < platonic_metrics["lastDrawStats"]["modelFrontFaces"] < 12 and platonic_metrics["lastDrawStats"]["modelVisibleEdges"] < 30 and platonic_metrics["lastDrawStats"]["modelHiddenEdges"] > 0 and platonic_metrics["lastDrawStats"]["modelFaceAlpha"] >= 0.7 and platonic_metrics["lastDrawStats"]["modelVertexFills"] == 0 and platonic_metrics["lastDrawStats"]["modelEdgeWidth"] >= 2.2 and platonic_metrics["lastDrawStats"]["modelEdgeAlpha"] >= 0.95 and platonic_metrics["modelVertexFills"] == 0 and platonic_metrics["platonicDrawCount"] >= 1, str(platonic_metrics["lastDrawStats"]))
            page.evaluate("() => window.__mobileApp.openSettings('info')")
            platonic_mckay = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                text: document.getElementById('mckay-card').innerText,
                curiosity: document.getElementById('curiosity-card').innerText,
                topbar: document.querySelector('.topbar').getAttribute('aria-label'),
                canvas: document.getElementById('mobile-canvas').getAttribute('aria-label'),
                info: document.getElementById('info-copy').textContent
            })""")
            check("McKay bridge follows active Platonic source", platonic_mckay["metrics"]["lastMckaySource"] == "dodecahedron" and platonic_mckay["metrics"]["lastMckayRoots"] == "E8" and "Dodecahedron" in platonic_mckay["text"] and "28 illustrative E8 highlights" in platonic_mckay["text"], str(platonic_mckay))
            check("Context note follows active Platonic source", platonic_mckay["metrics"]["lastCuriosityTitle"] == "Platonic source" and "Dodecahedron is the active symmetry source" in platonic_mckay["curiosity"], str(platonic_mckay))
            check("Platonic scene labels describe active solid", "Dodecahedron Platonic solid" in platonic_mckay["topbar"] and "20 vertices" in platonic_mckay["canvas"] and "desktop Platonic solid geometry" in platonic_mckay["info"] and platonic_mckay["metrics"]["lastSceneLabel"] == platonic_mckay["topbar"], str(platonic_mckay))
            platonic_data = page.evaluate("() => window.__mobileApp.copyModelData({ copy: false, download: false })")
            check("geometry data export follows Platonic solid", platonic_data["ok"] and platonic_data["geometry"]["kind"] == "polyhedron" and platonic_data["geometry"]["name"] == "dodecahedron" and len(platonic_data["geometry"]["verts"]) == 20 and len(platonic_data["geometry"]["edges"]) == 30 and len(platonic_data["geometry"]["faces"]) > 0 and platonic_data["geometry"]["mckay"]["roots"] == "E8", str(platonic_data["geometry"]))
            platonic_obj = page.evaluate("() => window.__mobileApp.copyModelObj({ copy: false, download: false })")
            check("OBJ export follows Platonic solid", platonic_obj["ok"] and platonic_obj["obj"]["kind"] == "polyhedron" and platonic_obj["obj"]["name"] == "dodecahedron" and platonic_obj["obj"]["vertices"] == 20 and platonic_obj["obj"]["lines"] == 30 and platonic_obj["obj"]["faces"] == 36, str(platonic_obj["obj"]))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.locator("#shape-select").evaluate("el => { el.value = 'icosahedron'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); }")
            icosahedron_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Platonic icosahedron renders twenty solid hull faces with occluded rear edges", icosahedron_metrics["lastModelMode"] == "platonic" and icosahedron_metrics["lastShape"] == "icosahedron" and icosahedron_metrics["lastDrawStats"]["modelVertices"] == 12 and icosahedron_metrics["lastDrawStats"]["modelEdges"] == 30 and icosahedron_metrics["lastDrawStats"]["modelFaces"] == 20 and icosahedron_metrics["lastDrawStats"]["modelFaceFills"] == 20 and 0 < icosahedron_metrics["lastDrawStats"]["modelFrontFaces"] < 20 and icosahedron_metrics["lastDrawStats"]["modelVisibleEdges"] < 30 and icosahedron_metrics["lastDrawStats"]["modelHiddenEdges"] > 0 and icosahedron_metrics["lastDrawStats"]["modelFaceAlpha"] >= 0.7 and icosahedron_metrics["lastDrawStats"]["modelVertexFills"] == 0, str(icosahedron_metrics["lastDrawStats"]))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.locator("#shape-select").evaluate("el => { el.value = 'great_icosahedron'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); }")
            star_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Great icosahedron renders generated desktop star geometry", star_metrics["lastModelMode"] == "platonic" and star_metrics["lastShape"] == "great_icosahedron" and star_metrics["lastDrawStats"]["modelVertices"] == 12 and star_metrics["lastDrawStats"]["modelEdges"] == 30 and star_metrics["lastDrawStats"]["modelFaces"] == 20 and star_metrics["lastDrawStats"]["modelFaceFills"] == 20 and star_metrics["lastDrawStats"]["modelVertexFills"] == 0, str(star_metrics["lastDrawStats"]))
            check("Star-polyhedron scene copy is accurate", "Great icosahedron star polyhedron" in star_metrics["lastSceneLabel"] and "Platonic solid" not in star_metrics["lastSceneLabel"] and star_metrics["lastMckaySource"] == "icosahedron", str(star_metrics))
            star_data = page.evaluate("() => window.__mobileApp.copyModelData({ copy: false, download: false })")
            check("geometry data export follows star polyhedron", star_data["ok"] and star_data["geometry"]["name"] == "great_icosahedron" and len(star_data["geometry"]["verts"]) == 12 and len(star_data["geometry"]["edges"]) == 30 and len(star_data["geometry"]["faces"]) == 20, str(star_data["geometry"]))
            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.locator("#model-select").evaluate("el => { el.value = 'poly4d'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            poly_select_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("model selector switches to 4D polytope controls", page.locator("#polytope4d-field:not(.hidden)").count() == 1 and page.locator("#shape-field.hidden").count() == 1 and poly_select_metrics["selectedRoot"] is None, str(poly_select_metrics))
            page.locator("#polytope4d-select").evaluate("el => { el.value = '600cell'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); }")
            poly_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("4D 600-cell renders brighter desktop polytope edges without vertex spheres", poly_metrics["lastModelMode"] == "poly4d" and poly_metrics["lastPolytope4D"] == "600cell" and poly_metrics["lastDrawStats"]["modelVertices"] == 120 and poly_metrics["lastDrawStats"]["modelProjectedVertices"] == 120 and poly_metrics["lastDrawStats"]["modelEdges"] == 720 and poly_metrics["lastDrawStats"]["modelEdgeStrokes"] == 1 and poly_metrics["lastDrawStats"]["modelEdgeWidth"] >= 1.0 and poly_metrics["lastDrawStats"]["modelEdgeAlpha"] >= 0.7 and poly_metrics["lastDrawStats"]["modelVertexFills"] == 0 and poly_metrics["polytope4DDrawCount"] >= 1, str(poly_metrics["lastDrawStats"]))
            page.evaluate("() => window.__mobileApp.openSettings('info')")
            poly_info = page.evaluate("""() => ({
                selection: document.getElementById('info-selection').innerText,
                info: document.getElementById('info-copy').textContent,
                topbar: document.querySelector('.topbar').getAttribute('aria-label'),
                canvas: document.getElementById('mobile-canvas').getAttribute('aria-label'),
                metrics: window.__mobileApp.getMetrics()
            })""")
            check("Info section describes active 4D model", "600-cell" in poly_info["selection"] and "120 vertices" in poly_info["selection"] and "720 edges" in poly_info["selection"], str(poly_info))
            check("4D scene labels describe active polytope", "600-cell 4D polytope" in poly_info["topbar"] and "120 vertices" in poly_info["canvas"] and "projected from 4D" in poly_info["info"] and poly_info["metrics"]["lastSceneLabel"] == poly_info["topbar"], str(poly_info))
            poly_data = page.evaluate("() => window.__mobileApp.copyModelData({ copy: false, download: false })")
            check("geometry data export follows 4D polytope", poly_data["ok"] and poly_data["geometry"]["kind"] == "4d-polytope" and poly_data["geometry"]["name"] == "600cell" and len(poly_data["geometry"]["verts"]) == 120 and len(poly_data["geometry"]["edges"]) == 720, str(poly_data["geometry"].keys()))
            poly_obj = page.evaluate("() => window.__mobileApp.copyModelObj({ copy: false, download: false })")
            check("OBJ export follows projected 4D polytope", poly_obj["ok"] and poly_obj["obj"]["kind"] == "4d-polytope-projected-obj" and poly_obj["obj"]["name"] == "600cell" and poly_obj["obj"]["vertices"] == 120 and poly_obj["obj"]["lines"] == 720 and poly_obj["obj"]["faces"] == 0, str(poly_obj["obj"]))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.locator("#polytope4d-select").evaluate("el => { el.value = '120cell'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); }")
            cell120_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("4D 120-cell is exposed and renders without vertex spheres", cell120_metrics["lastPolytope4D"] == "120cell" and cell120_metrics["lastDrawStats"]["modelVertices"] == 600 and cell120_metrics["lastDrawStats"]["modelEdges"] == 1200 and cell120_metrics["lastDrawStats"]["modelVertexFills"] == 0, str(cell120_metrics["lastDrawStats"]))
            cell120_data = page.evaluate("() => window.__mobileApp.copyModelData({ copy: false, download: false })")
            check("geometry data export follows 120-cell", cell120_data["ok"] and cell120_data["geometry"]["name"] == "120cell" and len(cell120_data["geometry"]["verts"]) == 600 and len(cell120_data["geometry"]["edges"]) == 1200, str(cell120_data["geometry"]))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.locator("#vertices-toggle").check()
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); }")
            vertices_on = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("Vertex nodes toggle restores optional 4D point markers", vertices_on["state"]["showVertices"] and vertices_on["metrics"]["lastDrawStats"]["modelVertexFills"] == 600, str(vertices_on))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.locator("#vertices-toggle").uncheck()
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); }")
            vertices_off = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("Vertex nodes toggle removes optional point markers cleanly", not vertices_off["state"]["showVertices"] and vertices_off["metrics"]["lastDrawStats"]["modelVertexFills"] == 0, str(vertices_off))
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.setState({ modelMode: 'poly4d', polytope4d: '24cell', autoModel: true, autoRotate: true, autoColor: false, softFx: false, rotation: 0 }); window.__mobileApp.forceRender(); }")
            poly_auto_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.wait_for_function("before => window.__mobileApp.getMetrics().autoModelSwitchCount > before && window.__mobileApp.getState().modelMode === 'poly4d'", arg=poly_auto_before["autoModelSwitchCount"], timeout=4000)
            poly_auto_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Auto model sequence includes 4D polytopes", poly_auto_after["lastAutoModelTarget"]["modelMode"] == "poly4d" and poly_auto_after["lastAutoModelTarget"]["polytope4d"] == "600cell" and poly_auto_after["lastPolytope4D"] == "600cell", str(poly_auto_after))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.locator("#model-select").evaluate("el => { el.value = 'dynkin'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            dynkin_select_probe = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                autoModelToggle: document.getElementById('auto-model-toggle').checked
            })""")
            check("model selector switches to Dynkin controls", page.locator("#dynkin-field:not(.hidden)").count() == 1 and page.locator("#shape-field.hidden").count() == 1 and page.locator("#polytope4d-field.hidden").count() == 1 and not dynkin_select_probe["state"]["autoModel"] and not dynkin_select_probe["autoModelToggle"], str(dynkin_select_probe))
            page.locator("#dynkin-select").evaluate("el => { el.value = 'E8'; el.dispatchEvent(new Event('change', { bubbles: true })); }")
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); }")
            dynkin_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("E8 Dynkin diagram renders desktop graph data", dynkin_metrics["lastModelMode"] == "dynkin" and dynkin_metrics["lastDynkinDiagram"] == "E8" and dynkin_metrics["lastDrawStats"]["modelVertices"] == 8 and dynkin_metrics["lastDrawStats"]["modelEdges"] == 7 and dynkin_metrics["lastDrawStats"]["modelEdgeStrokes"] == 1 and dynkin_metrics["dynkinDrawCount"] >= 1, str(dynkin_metrics["lastDrawStats"]))
            page.evaluate("() => window.__mobileApp.openSettings('info')")
            dynkin_info = page.evaluate("""() => ({
                selection: document.getElementById('info-selection').innerText,
                info: document.getElementById('info-copy').textContent,
                topbar: document.querySelector('.topbar').getAttribute('aria-label'),
                canvas: document.getElementById('mobile-canvas').getAttribute('aria-label'),
                metrics: window.__mobileApp.getMetrics()
            })""")
            check("Info section describes active Dynkin model", "E8 Dynkin diagram" in dynkin_info["selection"] and "8 simple roots" in dynkin_info["selection"] and "7 Cartan edges" in dynkin_info["selection"], str(dynkin_info))
            check("Dynkin scene labels describe active diagram", "E8 Dynkin diagram" in dynkin_info["topbar"] and "8 simple roots" in dynkin_info["canvas"] and "Tap an E8 node" in dynkin_info["info"] and dynkin_info["metrics"]["lastSceneLabel"] == dynkin_info["topbar"], str(dynkin_info))
            dynkin_data = page.evaluate("() => window.__mobileApp.copyModelData({ copy: false, download: false })")
            check("geometry data export follows Dynkin diagram", dynkin_data["ok"] and dynkin_data["geometry"]["kind"] == "dynkin-diagram" and dynkin_data["geometry"]["name"] == "E8" and dynkin_data["geometry"]["rank"] == 8 and len(dynkin_data["geometry"]["edges"]) == 7, str(dynkin_data["geometry"]))
            dynkin_obj = page.evaluate("() => window.__mobileApp.copyModelObj({ copy: false, download: false })")
            check("OBJ export follows Dynkin diagram", dynkin_obj["ok"] and dynkin_obj["obj"]["kind"] == "dynkin-graph-obj" and dynkin_obj["obj"]["name"] == "E8" and dynkin_obj["obj"]["vertices"] == 8 and dynkin_obj["obj"]["lines"] == 7 and dynkin_obj["obj"]["faces"] == 0, str(dynkin_obj["obj"]))
            dynkin_node = page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); return window.__mobileApp.getDynkinNodeScreenPoint(3); }")
            check("debug API exposes Dynkin node screen position", dynkin_node is not None and dynkin_node["order"] == 3 and dynkin_node["x"] > 0 and dynkin_node["y"] > 0, str(dynkin_node))
            dynkin_tap_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.mouse.click(dynkin_node["x"], dynkin_node["y"])
            dynkin_tap_after = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics(), info: document.getElementById('info-selection').innerText })")
            check("Dynkin E8 node tap selects matching simple root", dynkin_tap_after["state"]["selectedRoot"] == 1 and dynkin_tap_after["state"]["subset"] == "simple_roots" and dynkin_tap_after["metrics"]["dynkinNodeSelectCount"] > dynkin_tap_before["dynkinNodeSelectCount"] and dynkin_tap_after["metrics"]["lastDynkinNodeSelect"]["node"] == 3 and dynkin_tap_after["metrics"]["lastInteractionType"] == "dynkin-node-select" and "Root #1 (alpha 3)" in dynkin_tap_after["info"], str(dynkin_tap_after))
            page.evaluate("() => { window.__mobileApp.setState({ modelMode: 'poly4d', polytope4d: '120cell', autoModel: true, autoRotate: true, autoColor: false, softFx: false, selectedRoot: null, rotation: 0 }); window.__mobileApp.forceRender(); }")
            dynkin_auto_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.wait_for_function("before => window.__mobileApp.getMetrics().autoModelSwitchCount > before && window.__mobileApp.getState().modelMode === 'dynkin'", arg=dynkin_auto_before["autoModelSwitchCount"], timeout=4000)
            dynkin_auto_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Auto model sequence includes Dynkin diagram", dynkin_auto_after["lastAutoModelTarget"]["modelMode"] == "dynkin" and dynkin_auto_after["lastAutoModelTarget"]["dynkinDiagram"] == "E8" and dynkin_auto_after["lastDynkinDiagram"] == "E8", str(dynkin_auto_after))
            page.evaluate("() => { window.__mobileApp.setState({ autoModel: false, autoRotate: false, modelMode: 'platonic', shape: 'dodecahedron', selectedRoot: null }); window.__mobileApp.forceRender(); }")
            motion_model_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.evaluate("() => window.__mobileApp.setState({ autoRotate: true })")
            page.wait_for_function("before => window.__mobileApp.getMetrics().motionFrameRenderCount > before", arg=motion_model_before["motionFrameRenderCount"], timeout=1500)
            motion_model_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Platonic model uses auto-rotate loop", motion_model_after["motionActive"] and motion_model_after["motionFrameRenderCount"] > motion_model_before["motionFrameRenderCount"] and motion_model_after["lastModelMode"] == "platonic", str(motion_model_after))
            page.evaluate("() => { window.__mobileApp.setState({ modelMode: 'e8_2d', shape: 'icosahedron', polytope4d: '24cell', dynkinDiagram: 'E8', palette: 'gold', autoRotate: false, autoModel: false, selectedRoot: null, rotation: 0, panX: 0, panY: 0, zoom: 1 }); window.__mobileApp.forceRender(); }")
            reset_model_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("model reset returns to E8 Coxeter renderer", reset_model_metrics["lastModelMode"] == "e8_2d" and reset_model_metrics["lastDrawStats"]["projectedPoints"] == 240, str(reset_model_metrics["lastDrawStats"]))
            page.evaluate("() => { window.__mobileApp.fitAllRoots(); window.__mobileApp.forceRender(); window.__mobileApp.hideStatus(); window.__mobileApp.openSettings('style'); }")

            background_options = page.locator("#background-select option").evaluate_all(
                "options => options.map(option => ({ value: option.value, label: option.textContent.trim() }))"
            )
            expected_backgrounds = [
                {"value": "void", "label": "Void"},
                {"value": "starfield", "label": "Space"},
                {"value": "grid", "label": "Grid"},
                {"value": "aurora", "label": "Cloud"},
                {"value": "cosmos", "label": "Cosmos"},
                {"value": "mandala", "label": "Mandala"},
                {"value": "plasma", "label": "Plasma"},
                {"value": "vortex", "label": "Vortex"},
                {"value": "quantum", "label": "Quantum"},
                {"value": "eclipse", "label": "Eclipse"},
                {"value": "synthwave", "label": "Barset"},
                {"value": "prism", "label": "Prism"},
            ]
            check("Visuals section exposes the full desktop background catalog", background_options == expected_backgrounds, str(background_options))
            legacy_backgrounds = page.evaluate("""() => {
                const space = window.__mobileApp.setState({ background: 'space' }).background;
                const cloud = window.__mobileApp.setState({ background: 'cloud' }).background;
                return { space, cloud };
            }""")
            check("legacy mobile backgrounds migrate to desktop identifiers", legacy_backgrounds == {"space": "starfield", "cloud": "aurora"}, str(legacy_backgrounds))
            background_rendering = page.evaluate("""() => {
                const app = window.__mobileApp;
                const modes = ['void', 'starfield', 'grid', 'aurora', 'cosmos', 'mandala', 'plasma', 'vortex', 'quantum', 'eclipse', 'synthwave', 'prism'];
                const expectedRenderers = ['flat', 'stars', 'grid', 'aurora', 'cosmos', 'mandala', 'plasma', 'vortex', 'quantum', 'eclipse', 'synthwave', 'prism'];
                app.closeSettings();
                const results = modes.map((mode, index) => {
                    app.setState({ background: mode, backgroundBrightness: 0.7, autoRotate: false, autoColor: false, softFx: false });
                    app.forceRender();
                    const stats = app.getMetrics().lastDrawStats;
                    return {
                        mode,
                        expectedRenderer: expectedRenderers[index],
                        renderedMode: stats.backgroundMode,
                        renderer: stats.backgroundRenderer,
                        primitives: stats.backgroundPrimitives,
                    };
                });
                app.setState({ background: 'void', backgroundBrightness: 0.7 });
                app.forceRender();
                const canvas = document.getElementById('mobile-background-canvas');
                const context = canvas.getContext('2d');
                const topLeft = [...context.getImageData(3, 3, 1, 1).data];
                const bottomLeft = [...context.getImageData(3, canvas.height - 4, 1, 1).data];
                app.openSettings('style');
                return { results, topLeft, bottomLeft, runtimeErrors: app.getMetrics().runtimeErrors };
            }""")
            check(
                "every mobile background renders through its dedicated scene",
                all(
                    item["renderedMode"] == item["mode"]
                    and item["renderer"] == item["expectedRenderer"]
                    and item["primitives"] >= (1 if item["mode"] == "void" else 2)
                    for item in background_rendering["results"]
                ),
                str(background_rendering),
            )
            check("Void background is flat instead of a hazy radial wash", background_rendering["topLeft"] == background_rendering["bottomLeft"], str(background_rendering))
            check("background catalog renders without runtime errors", not background_rendering["runtimeErrors"], str(background_rendering["runtimeErrors"]))

            palette_grid = page.evaluate("""() => ({
                buttons: [...document.querySelectorAll('#palette-swatch-grid [data-palette-swatch]')].map(button => ({
                    id: button.dataset.paletteSwatch,
                    text: button.textContent.trim(),
                    active: button.classList.contains('active'),
                    pressed: button.getAttribute('aria-pressed')
                })),
                output: document.getElementById('palette-output').textContent.trim(),
                select: document.getElementById('palette-select').value,
                metrics: window.__mobileApp.getMetrics()
            })""")
            palette_ids = [button["id"] for button in palette_grid["buttons"]]
            check("Visuals section exposes the full desktop palette catalog", len(palette_grid["buttons"]) == 45 and palette_grid["metrics"]["paletteSwatchButtonCount"] == 45 and palette_ids[:4] == ["gold", "ember", "ice", "cyan"] and all(name in palette_ids for name in ["rainbow", "aurora", "ultraviolet", "solar_flare", "petrie", "vintage"]), str(palette_grid))
            check("palette swatches mark active Gold palette", palette_grid["output"] == "Gold" and palette_grid["select"] == "gold" and any(button["id"] == "gold" and button["active"] and button["pressed"] == "true" for button in palette_grid["buttons"]), str(palette_grid))
            palette_swatch_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#palette-swatch-grid [data-palette-swatch="ember"]').click()
            palette_swatch_after = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    select: document.getElementById('palette-select').value,
                    output: document.getElementById('palette-output').textContent.trim(),
                    activeSwatch: document.querySelector('#palette-swatch-grid button.active')?.dataset.paletteSwatch
                }
            })""")
            check("palette swatch changes state and controls", palette_swatch_after["state"]["palette"] == "ember" and palette_swatch_after["controls"]["select"] == "ember" and palette_swatch_after["controls"]["output"] == "Ember" and palette_swatch_after["controls"]["activeSwatch"] == "ember", str(palette_swatch_after))
            check("palette swatch uses lightweight settings sync", palette_swatch_after["metrics"]["paletteSwatchSelectCount"] > palette_swatch_before["paletteSwatchSelectCount"] and palette_swatch_after["metrics"]["paletteSwatchSyncSkipCount"] > palette_swatch_before["paletteSwatchSyncSkipCount"] and palette_swatch_after["metrics"]["settingsControlSyncSkipCount"] > palette_swatch_before["settingsControlSyncSkipCount"] and palette_swatch_after["metrics"]["controlSyncCount"] == palette_swatch_before["controlSyncCount"] and palette_swatch_after["metrics"]["lastPaletteSwatch"] == "ember" and palette_swatch_after["metrics"]["lastSettingsControlSyncSkip"] == "palette-swatch-ember", str(palette_swatch_after["metrics"]))
            palette_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#palette-select").select_option("cyan")
            palette_metrics = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                activeSwatch: document.querySelector('#palette-swatch-grid button.active')?.dataset.paletteSwatch,
                output: document.getElementById('palette-output').textContent.trim(),
                storedPalette: window.__mobileApp.getStoredState()?.palette
            })""")
            check("palette changes state", page.evaluate("() => window.__mobileApp.getState().palette") == "cyan")
            check("palette setting skips full control sync", palette_metrics["metrics"]["settingsControlSyncSkipCount"] > palette_before["settingsControlSyncSkipCount"] and palette_metrics["metrics"]["lastSettingsControlSyncSkip"] == "palette-select" and palette_metrics["metrics"]["controlSyncCount"] == palette_before["controlSyncCount"] and palette_metrics["metrics"]["liveControlSyncSkipCount"] == palette_before["liveControlSyncSkipCount"], str(palette_metrics))
            check("palette select syncs swatches", palette_metrics["activeSwatch"] == "cyan" and palette_metrics["output"] == "Cyan", str(palette_metrics))
            check("state save is pending or persisted", palette_metrics["metrics"]["savePending"] or palette_metrics["metrics"]["saveCount"] > palette_before["saveCount"] or palette_metrics["storedPalette"] == "cyan", str(palette_metrics))
            palette_saved = page.evaluate("""() => {
                window.__mobileApp.flushSave();
                return {
                    stored: window.__mobileApp.getStoredState()?.palette,
                    pending: window.__mobileApp.getMetrics().savePending,
                };
            }""")
            check("palette state reaches localStorage", palette_saved["stored"] == "cyan", str(palette_saved))
            check("flush leaves no pending save", not palette_saved["pending"], str(palette_saved))
            page.locator("#background-select").select_option("eclipse")
            page.locator("#background-brightness").evaluate("""el => { el.value = '0.9'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }""")
            page.locator("#point-opacity").evaluate("""el => { el.value = '0.85'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }""")
            page.locator("#color-speed").evaluate("""el => { el.value = '1.2'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }""")
            page.locator("#fx-strength").evaluate("""el => { el.value = '1.25'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }""")
            visual_controls = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                backgroundOutput: document.getElementById('background-brightness-output').textContent.trim(),
                opacityOutput: document.getElementById('point-opacity-output').textContent.trim(),
                colorSpeedOutput: document.getElementById('color-speed-output').textContent.trim(),
                fxStrengthOutput: document.getElementById('fx-strength-output').textContent.trim()
            })""")
            check("Visuals section exposes functional background, opacity, shift speed, and FX strength controls", visual_controls["state"]["background"] == "eclipse" and abs(visual_controls["state"]["backgroundBrightness"] - 0.9) < 0.01 and abs(visual_controls["state"]["pointOpacity"] - 0.85) < 0.01 and abs(visual_controls["state"]["colorSpeed"] - 1.2) < 0.01 and abs(visual_controls["state"]["fxStrength"] - 1.25) < 0.01 and visual_controls["backgroundOutput"] == "90%" and visual_controls["opacityOutput"] == "85%" and visual_controls["colorSpeedOutput"] == "Fast" and visual_controls["fxStrengthOutput"] == "125%", str(visual_controls))
            fx_grid = page.evaluate("""() => ({
                buttons: [...document.querySelectorAll('#fx-preset-grid [data-fx-preset]')].map(button => ({
                    id: button.dataset.fxPreset,
                    text: button.textContent.trim(),
                    active: button.classList.contains('active'),
                    pressed: button.getAttribute('aria-pressed')
                })),
                output: document.getElementById('fx-preset-output').textContent.trim(),
                metrics: window.__mobileApp.getMetrics()
            })""")
            fx_ids = [button["id"] for button in fx_grid["buttons"]]
            check("Visuals section exposes compact color and motion presets", len(fx_grid["buttons"]) == 4 and fx_grid["metrics"]["fxPresetButtonCount"] == 4 and fx_ids == ["clean", "pulse", "color", "live"] and [button["text"] for button in fx_grid["buttons"]] == ["Static", "Breathe", "Color Shift", "Color + Breathe"], str(fx_grid))
            check("Color and motion presets mark active Static state", fx_grid["output"] == "Static" and any(button["id"] == "clean" and button["active"] and button["pressed"] == "true" for button in fx_grid["buttons"]), str(fx_grid))
            fx_modes = page.evaluate("""() => ({
                buttons: [...document.querySelectorAll('#fx-mode-grid [data-fx-treatment]')].map(button => ({
                    id: button.dataset.fxTreatment,
                    label: button.querySelector('span')?.textContent.trim(),
                    cost: button.dataset.fxCost,
                    costText: button.querySelector('small')?.textContent.trim(),
                    active: button.classList.contains('active'),
                    pressed: button.getAttribute('aria-pressed')
                })),
                output: document.getElementById('fx-mode-output').textContent.trim(),
                description: document.getElementById('fx-mode-description').textContent.trim(),
                shellMode: document.querySelector('.mobile-shell').dataset.fxMode,
                metrics: window.__mobileApp.getMetrics()
            })""")
            fx_mode_ids = [button["id"] for button in fx_modes["buttons"]]
            desktop_fx_ids = ["none", "glow", "pulse", "trail", "chromatic", "kaleidoscope", "ripple", "spiral", "fog", "heat", "edge-glow", "aura", "voronoi", "caustic", "iridescent", "flowfield", "plasma", "kaleido6", "dof", "nebula", "wireframe", "hologram", "xray", "crystal"]
            check("Visuals exposes the complete 24-effect desktop catalog", fx_mode_ids == desktop_fx_ids and fx_modes["metrics"]["fxModeButtonCount"] == 24 and fx_modes["output"] == "Off" and fx_modes["shellMode"] == "none" and any(button["id"] == "none" and button["active"] and button["pressed"] == "true" for button in fx_modes["buttons"]), str(fx_modes))
            fx_costs = {button["id"]: button["cost"] for button in fx_modes["buttons"]}
            check("Effect buttons expose desktop-compatible GPU cost badges", all(button["cost"] in ["low", "medium", "high"] and button["costText"] == button["cost"] for button in fx_modes["buttons"]) and fx_costs["voronoi"] == "high" and fx_costs["trail"] == "medium" and fx_costs["glow"] == "low", str(fx_modes["buttons"]))
            fx_budget_note = page.locator(".fx-cost-note").inner_text()
            check("Effects explains the mobile dense-graph safety budget", "20 fps" in fx_budget_note and "E8 full chords" in fx_budget_note, fx_budget_note)
            dense_fx_budget = page.evaluate("""() => {
                const app = window.__mobileApp;
                app.setState({ modelMode: 'e8_2d', showEdges: true, fxMode: 'ripple', autoRotate: true, autoColor: true, softFx: true });
                const gpu = { state: app.getState(), metrics: app.getMetrics() };
                app.setState({ fxMode: 'glow' });
                const composited = { state: app.getState(), metrics: app.getMetrics() };
                app.setState({ showEdges: false });
                const regular = { state: app.getState(), metrics: app.getMetrics() };
                app.setState({ fxMode: 'none', autoRotate: false, autoColor: false, softFx: false });
                return { gpu, composited, regular };
            }""")
            check("GPU-native Ripple keeps full chords on the smoother motion budget", dense_fx_budget["gpu"]["state"]["fxMode"] == "ripple" and dense_fx_budget["gpu"]["state"]["showEdges"] and dense_fx_budget["gpu"]["state"]["autoRotate"] and dense_fx_budget["gpu"]["state"]["autoColor"] and dense_fx_budget["gpu"]["state"]["softFx"] and dense_fx_budget["gpu"]["metrics"]["motionFrameTargetMs"] == 33 and dense_fx_budget["gpu"]["metrics"]["lastE8ChordRenderer"] == "webgl-lines", str(dense_fx_budget["gpu"]))
            check("Canvas-composited E8 FX retain the phone-safe motion budget", dense_fx_budget["composited"]["state"]["fxMode"] == "glow" and dense_fx_budget["composited"]["state"]["showEdges"] and dense_fx_budget["composited"]["metrics"]["motionFrameTargetMs"] == 50, str(dense_fx_budget["composited"]))
            check("normal mobile scenes retain the smoother motion budget", not dense_fx_budget["regular"]["state"]["showEdges"] and dense_fx_budget["regular"]["metrics"]["motionFrameTargetMs"] == 33, str(dense_fx_budget["regular"]))
            fx_rendering = page.evaluate("""ids => {
                window.__mobileApp.setState({ modelMode: 'e8_2d', showEdges: true, autoRotate: false, autoColor: false, softFx: false });
                const canvas = document.getElementById('mobile-canvas');
                const chords = document.getElementById('mobile-e8-chord-canvas');
                const sdf = document.getElementById('mobile-sdf-canvas');
                const background = document.getElementById('mobile-background-canvas');
                return ids.map(id => {
                    window.__mobileApp.selectFxMode(id);
                    window.__mobileApp.forceRender();
                    const stats = window.__mobileApp.getMetrics().lastDrawStats;
                    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                    let canvasSignature = 2166136261;
                    const stride = Math.max(4, Math.floor(pixels.length / 8192 / 4) * 4);
                    for (let offset = 0; offset < pixels.length; offset += stride) {
                        canvasSignature ^= pixels[offset] + pixels[offset + 1] * 3 + pixels[offset + 2] * 7 + pixels[offset + 3] * 11;
                        canvasSignature = Math.imul(canvasSignature, 16777619);
                    }
                    return {
                        id,
                        state: window.__mobileApp.getState().fxMode,
                        canvasFilter: getComputedStyle(canvas).filter,
                        chordFilter: getComputedStyle(chords).filter,
                        chordActive: chords.classList.contains('active'),
                        chordComposited: chords.classList.contains('fx-composited'),
                        sdfFilter: getComputedStyle(sdf).filter,
                        backgroundFilter: getComputedStyle(background).filter,
                        fxRenderer: stats.fxRenderer,
                        fxOverlayApplied: stats.fxOverlayApplied,
                        fxOverlayPrimitives: stats.fxOverlayPrimitives,
                        nativeFxApplied: stats.nativeFxApplied,
                        nativeFxPrimitives: stats.nativeFxPrimitives,
                        canvasFxPassApplied: stats.canvasFxPassApplied,
                        canvasFxPassPrimitives: stats.canvasFxPassPrimitives,
                        canvasFxPassRenderer: stats.canvasFxPassRenderer,
                        canvasSignature: (canvasSignature >>> 0).toString(16),
                        ripplePointCount: stats.ripplePointCount,
                        e8ChordRenderer: stats.e8ChordRenderer,
                        e8ChordGpuDrawCalls: stats.e8ChordGpuDrawCalls
                    };
                });
            }""", desktop_fx_ids)
            check("Every mobile effect has a native Canvas and SDF-safe visual treatment", all(item["state"] == item["id"] and (item["id"] == "none" or item["nativeFxApplied"]) and (item["id"] == "none" or item["sdfFilter"] != "none") for item in fx_rendering), str(fx_rendering))
            check("FX never filters or overlays the background layer", all(item["backgroundFilter"] == "none" for item in fx_rendering), str(fx_rendering))
            composite_ids = set(desktop_fx_ids) - {"none", "ripple"}
            check("All non-Ripple Canvas effects use the native foreground compositor", all(item["canvasFxPassApplied"] and item["canvasFxPassPrimitives"] > 0 and item["canvasFxPassRenderer"] == f"canvas-composite-{item['id']}" for item in fx_rendering if item["id"] in composite_ids), str(fx_rendering))
            check("GPU chords feed the Canvas FX compositor without double painting", all(item["e8ChordRenderer"] == "webgl-lines" and item["e8ChordGpuDrawCalls"] == 1 and item["chordActive"] and item["chordComposited"] for item in fx_rendering if item["id"] in composite_ids) and all(item["chordActive"] and not item["chordComposited"] for item in fx_rendering if item["id"] in {"none", "ripple"}), str(fx_rendering))
            check("All 24 Canvas effects produce visibly distinct model pixels", len({item["canvasSignature"] for item in fx_rendering}) == len(desktop_fx_ids), str(fx_rendering))
            patterned_ids = {"kaleidoscope", "spiral", "voronoi", "caustic", "iridescent", "flowfield", "plasma", "kaleido6", "nebula", "hologram"}
            check("Procedural Canvas FX retain foreground-clipped pattern detail", all(item["fxRenderer"] == f"canvas-composite-{item['id']}" and item["fxOverlayApplied"] and item["fxOverlayPrimitives"] > 0 for item in fx_rendering if item["id"] in patterned_ids), str(fx_rendering))
            ripple_native = next(item for item in fx_rendering if item["id"] == "ripple")
            check("Ripple uses native radial geometry instead of painted cyan rings", ripple_native["fxRenderer"] == "geometry-ripple" and ripple_native["nativeFxApplied"] and ripple_native["nativeFxPrimitives"] >= 240 and ripple_native["ripplePointCount"] == 240 and not ripple_native["fxOverlayApplied"] and ripple_native["fxOverlayPrimitives"] == 0, str(ripple_native))
            ripple_reference = page.evaluate("""() => {
                const app = window.__mobileApp;
                const edgeToggle = document.getElementById('edges-toggle');
                edgeToggle.checked = true;
                edgeToggle.dispatchEvent(new Event('change', { bubbles: true }));
                app.setState({ modelMode: 'e8_2d', palette: 'rainbow', fxMode: 'ripple', showRings: false, autoRotate: false, autoColor: false, softFx: false });
                app.forceRender();
                return {
                    state: app.getState(),
                    metrics: app.getMetrics(),
                    stats: app.getMetrics().lastDrawStats,
                    edgeToggleExists: !!edgeToggle,
                    edgeToggleChecked: edgeToggle.checked,
                    backgroundFilter: getComputedStyle(document.getElementById('mobile-background-canvas')).filter
                };
            }""")
            ripple_stats = ripple_reference["stats"]
            check("Rainbow Ripple reproduces the full desktop E8 chord topology", ripple_reference["edgeToggleExists"] and ripple_reference["edgeToggleChecked"] and ripple_reference["state"]["showEdges"] and ripple_reference["state"]["palette"] == "rainbow" and ripple_stats["fxRenderer"] == "geometry-ripple" and ripple_stats["e8ChordEdges"] == 21840 and ripple_stats["e8ChordClassCount"] == 2 and ripple_stats["e8ChordClassCounts"] == [0, 0, 0, 6720, 0, 0, 0, 15120] and ripple_reference["metrics"]["e8ChordEdgeCount"] == 21840 and ripple_reference["metrics"]["e8ChordDegreeMin"] == 182 and ripple_reference["metrics"]["e8ChordDegreeMax"] == 182 and ripple_stats["rippleEdgeSegments"] == ripple_stats["e8ChordEdges"] and ripple_stats["rippleColorBands"] >= 10 and ripple_stats["rippleBrightnessBands"] == 5 and ripple_stats["ripplePointCount"] == 240 and not ripple_stats["fxOverlayApplied"] and ripple_reference["backgroundFilter"] == "none", str(ripple_reference))
            page.evaluate("() => window.__mobileApp.setState({ showEdges: false, showRings: true, palette: 'gold' })")
            page.evaluate("() => window.__mobileApp.selectFxMode('none')")
            fx_mode_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#fx-mode-grid [data-fx-treatment="hologram"]').click()
            hologram_fx = page.evaluate("""() => {
                const shell = document.querySelector('.mobile-shell');
                window.__mobileApp.forceRender();
                return {
                    state: window.__mobileApp.getState(),
                    metrics: window.__mobileApp.getMetrics(),
                    shellMode: shell.dataset.fxMode,
                    canvasFilter: getComputedStyle(document.getElementById('mobile-canvas')).filter,
                    sdfFilter: getComputedStyle(document.getElementById('mobile-sdf-canvas')).filter,
                    backgroundFilter: getComputedStyle(document.getElementById('mobile-background-canvas')).filter,
                    drawStats: window.__mobileApp.getMetrics().lastDrawStats,
                    output: document.getElementById('fx-mode-output').textContent.trim(),
                    description: document.getElementById('fx-mode-description').textContent.trim(),
                    active: document.querySelector('#fx-mode-grid button.active')?.dataset.fxTreatment,
                    strength: shell.style.getPropertyValue('--mobile-fx-strength').trim()
                };
            }""")
            check("Hologram FX applies to both Canvas and SDF surfaces", hologram_fx["state"]["fxMode"] == "hologram" and hologram_fx["shellMode"] == "hologram" and hologram_fx["canvasFilter"] != "none" and hologram_fx["sdfFilter"] != "none" and hologram_fx["backgroundFilter"] == "none" and hologram_fx["drawStats"]["fxRenderer"] == "canvas-composite-hologram" and hologram_fx["drawStats"]["canvasFxPassApplied"] and hologram_fx["output"] == "Hologram" and "scanlines" in hologram_fx["description"] and hologram_fx["active"] == "hologram" and hologram_fx["strength"] == "1.25", str(hologram_fx))
            check("FX treatment uses lightweight settings sync", hologram_fx["metrics"]["fxModeSelectCount"] > fx_mode_before["fxModeSelectCount"] and hologram_fx["metrics"]["fxModeSyncSkipCount"] > fx_mode_before["fxModeSyncSkipCount"] and hologram_fx["metrics"]["lastFxMode"] == "hologram" and hologram_fx["metrics"]["lastSettingsControlSyncSkip"] == "fx-mode-hologram" and hologram_fx["metrics"]["controlSyncCount"] == fx_mode_before["controlSyncCount"], str(hologram_fx["metrics"]))
            page.evaluate("() => window.__mobileApp.selectModelShortcut('sdf')")
            sdf_hologram = page.evaluate("""() => ({
                ...(() => { window.__mobileApp.forceRender(); return {}; })(),
                state: window.__mobileApp.getState(),
                shellMode: document.querySelector('.mobile-shell').dataset.fxMode,
                filter: getComputedStyle(document.getElementById('mobile-sdf-canvas')).filter,
                backgroundFilter: getComputedStyle(document.getElementById('mobile-background-canvas')).filter,
                fxRenderer: window.__mobileApp.getMetrics().lastDrawStats.fxRenderer
            })""")
            check("FX treatment persists through the native SDF shader", sdf_hologram["state"]["modelMode"] == "sdf" and sdf_hologram["state"]["fxMode"] == "hologram" and sdf_hologram["shellMode"] == "hologram" and sdf_hologram["filter"] != "none" and sdf_hologram["backgroundFilter"] == "none" and sdf_hologram["fxRenderer"] == "sdf-shader", str(sdf_hologram))
            sdf_fx_sweep = page.evaluate("""ids => {
                const app = window.__mobileApp;
                const background = document.getElementById('mobile-background-canvas');
                const sdf = document.getElementById('mobile-sdf-canvas');
                const checksum = canvas => {
                    const text = canvas.toDataURL();
                    let hash = 2166136261;
                    for (let index = 0; index < text.length; index += 101) {
                        hash ^= text.charCodeAt(index);
                        hash = Math.imul(hash, 16777619);
                    }
                    return hash >>> 0;
                };
                app.setState({ modelMode: 'sdf', background: 'vortex', quality: 'smooth', autoRotate: false, autoColor: false, softFx: false });
                return ids.map(id => {
                    app.setState({ fxMode: id });
                    app.forceRender();
                    return {
                        id,
                        sdf: checksum(sdf),
                        background: checksum(background),
                        renderer: app.getMetrics().lastDrawStats.fxRenderer
                    };
                });
            }""", desktop_fx_ids)
            check("All 24 native SDF effects produce distinct model frames", len({item["sdf"] for item in sdf_fx_sweep}) == 24 and all(item["renderer"] == "sdf-shader" for item in sdf_fx_sweep), str(sdf_fx_sweep))
            check("SDF effect sweep leaves the selected background pixel-identical", len({item["background"] for item in sdf_fx_sweep}) == 1, str(sdf_fx_sweep))
            sdf_fx_animation_before = page.evaluate("""() => {
                const app = window.__mobileApp;
                app.setState({ modelMode: 'sdf', fxMode: 'pulse', autoRotate: false, autoColor: false, softFx: false });
                app.forceRender();
                const metrics = app.getMetrics();
                app.closeSettings('sdf-fx-animation-test');
                return { renderCount: metrics.renderCount, stylePhase: metrics.lastStylePhase };
            }""")
            page.wait_for_timeout(220)
            sdf_fx_animation_after = page.evaluate("""() => {
                const app = window.__mobileApp;
                const metrics = app.getMetrics();
                const result = { renderCount: metrics.renderCount, stylePhase: metrics.lastStylePhase, state: app.getState(), stats: metrics.lastDrawStats };
                app.openSettings('style');
                return result;
            }""")
            check("Animated FX continue moving through the native SDF shader", sdf_fx_animation_after["state"]["modelMode"] == "sdf" and sdf_fx_animation_after["state"]["fxMode"] == "pulse" and sdf_fx_animation_after["renderCount"] > sdf_fx_animation_before["renderCount"] and sdf_fx_animation_after["stylePhase"] != sdf_fx_animation_before["stylePhase"] and sdf_fx_animation_after["stats"]["fxRenderer"] == "sdf-shader", str({"before": sdf_fx_animation_before, "after": sdf_fx_animation_after}))
            page.evaluate("() => window.__mobileApp.selectModelShortcut('e8_2d')")
            page.locator('#fx-mode-grid [data-fx-treatment="none"]').click()
            clean_treatment = page.evaluate("""() => ({
                ...(() => { window.__mobileApp.forceRender(); return {}; })(),
                state: window.__mobileApp.getState(),
                mode: document.querySelector('.mobile-shell').dataset.fxMode,
                filter: getComputedStyle(document.getElementById('mobile-canvas')).filter,
                backgroundFilter: getComputedStyle(document.getElementById('mobile-background-canvas')).filter,
                fxOverlayApplied: window.__mobileApp.getMetrics().lastDrawStats.fxOverlayApplied
            })""")
            check("Off treatment removes foreground effects without changing the background", clean_treatment["state"]["fxMode"] == "none" and clean_treatment["mode"] == "none" and clean_treatment["filter"] == "none" and clean_treatment["backgroundFilter"] == "none" and not clean_treatment["fxOverlayApplied"], str(clean_treatment))
            fx_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#fx-preset-grid [data-fx-preset="live"]').click()
            fx_live = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    autoColor: document.getElementById('auto-color-toggle').checked,
                    softFx: document.getElementById('soft-fx-toggle').checked,
                    activeFx: document.querySelector('#fx-preset-grid button.active')?.dataset.fxPreset,
                    fxOutput: document.getElementById('fx-preset-output').textContent.trim(),
                    motionOutput: document.getElementById('motion-preset-output').textContent.trim()
                }
            })""")
            check("Color + Breathe preset enables color and pulse", fx_live["state"]["autoColor"] and fx_live["state"]["softFx"] and fx_live["controls"]["autoColor"] and fx_live["controls"]["softFx"] and fx_live["controls"]["activeFx"] == "live" and fx_live["controls"]["fxOutput"] == "Color + Breathe", str(fx_live))
            check("Color + Breathe preset uses lightweight settings sync", fx_live["metrics"]["fxPresetSelectCount"] > fx_before["fxPresetSelectCount"] and fx_live["metrics"]["fxPresetSyncSkipCount"] > fx_before["fxPresetSyncSkipCount"] and fx_live["metrics"]["settingsControlSyncSkipCount"] > fx_before["settingsControlSyncSkipCount"] and fx_live["metrics"]["lastSettingsControlSyncSkip"] == "fx-preset-live" and fx_live["metrics"]["controlSyncCount"] == fx_before["controlSyncCount"] and fx_live["metrics"]["lastFxPreset"] == "live", str(fx_live["metrics"]))
            page.locator('#fx-preset-grid [data-fx-preset="clean"]').click()
            fx_clean = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    autoColor: document.getElementById('auto-color-toggle').checked,
                    softFx: document.getElementById('soft-fx-toggle').checked,
                    activeFx: document.querySelector('#fx-preset-grid button.active')?.dataset.fxPreset,
                    fxOutput: document.getElementById('fx-preset-output').textContent.trim(),
                    motionOutput: document.getElementById('motion-preset-output').textContent.trim()
                }
            })""")
            check("Static preset disables supplemental color and breathing", not fx_clean["state"]["autoColor"] and not fx_clean["state"]["softFx"] and not fx_clean["controls"]["autoColor"] and not fx_clean["controls"]["softFx"] and fx_clean["controls"]["activeFx"] == "clean" and fx_clean["controls"]["fxOutput"] == "Static" and fx_clean["controls"]["motionOutput"] == "Still", str(fx_clean))
            style_anim_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#auto-color-toggle").check()
            page.locator("#soft-fx-toggle").check()
            style_anim_set = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                activeFx: document.querySelector('#fx-preset-grid button.active')?.dataset.fxPreset,
                fxOutput: document.getElementById('fx-preset-output').textContent.trim()
            })""")
            check("Visuals section exposes color shift and soft FX toggles", style_anim_set["state"]["autoColor"] and style_anim_set["state"]["softFx"] and style_anim_set["metrics"]["lastSettingsControlSyncSkip"] == "soft-fx-toggle", str(style_anim_set))
            check("Color and motion chips sync from fallback toggles", style_anim_set["activeFx"] == "live" and style_anim_set["fxOutput"] == "Color + Breathe", str(style_anim_set))
            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.wait_for_function("before => window.__mobileApp.getMetrics().motionFrameRenderCount > before", arg=style_anim_before["motionFrameRenderCount"], timeout=1500)
            style_anim_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("auto color and soft FX use runtime animation loop", style_anim_after["motionActive"] and style_anim_after["runtimeAnimationActive"] and style_anim_after["autoColorFrameCount"] > style_anim_before["autoColorFrameCount"] and style_anim_after["softFxFrameCount"] > style_anim_before["softFxFrameCount"] and style_anim_after["lastDrawStats"]["autoColor"] and style_anim_after["lastDrawStats"]["softFx"] and style_anim_after["lastRuntimePalette"] is not None, str(style_anim_after))
            check("auto color and soft FX avoid per-frame save churn", style_anim_after["saveCount"] <= style_anim_set["metrics"]["saveCount"] + 1, str({"before": style_anim_set["metrics"]["saveCount"], "after": style_anim_after["saveCount"]}))
            page.evaluate("() => { window.__mobileApp.setState({ modelMode: 'e8_2d', shape: 'icosahedron', autoRotate: false, autoModel: false, autoColor: false, softFx: false, selectedRoot: 7, rotation: 0, panX: 0, panY: 0, zoom: 1 }); window.__mobileApp.forceRender(); window.__mobileApp.openSettings('motion'); }")
            show_button = page.locator('[data-motion-action="showcase"]').bounding_box()
            orbit_button = page.locator('[data-motion-action="orbit"]').bounding_box()
            still_button = page.locator('[data-motion-action="still"]').bounding_box()
            auto_model_toggle = page.locator("#auto-model-toggle").bounding_box()
            motion_preset_grid = page.evaluate("""() => ({
                buttons: [...document.querySelectorAll('#motion-preset-grid [data-motion-action]')].map(button => ({
                    id: button.dataset.motionAction,
                    text: button.textContent.trim(),
                    active: button.classList.contains('active'),
                    pressed: button.getAttribute('aria-pressed')
                })),
                output: document.getElementById('motion-preset-output').textContent.trim(),
                metrics: window.__mobileApp.getMetrics()
            })""")
            check("Motion section exposes compact auto model controls", bool(show_button) and show_button["height"] >= 40 and bool(orbit_button) and orbit_button["height"] >= 40 and bool(still_button) and still_button["height"] >= 40 and bool(auto_model_toggle) and auto_model_toggle["height"] >= 20 and motion_preset_grid["metrics"]["motionPresetButtonCount"] == 3, str({"show": show_button, "orbit": orbit_button, "still": still_button, "toggle": auto_model_toggle, "grid": motion_preset_grid}))
            check("Motion presets mark active Still state", motion_preset_grid["output"] == "Still" and any(button["id"] == "still" and button["active"] and button["pressed"] == "true" for button in motion_preset_grid["buttons"]), str(motion_preset_grid))
            camera_controls = page.evaluate("""() => ({
                buttons: [...document.querySelectorAll('.camera-path-grid [data-motion-action]')].map(button => ({ id: button.dataset.motionAction, height: button.getBoundingClientRect().height })),
                rotation: document.getElementById('camera-rotation-output').textContent,
                tilt: document.getElementById('camera-tilt-output').textContent,
                zoom: document.getElementById('camera-zoom-output').textContent,
                extrude: document.getElementById('camera-extrude-output').textContent,
                zoomAuto: { pressed: document.getElementById('camera-zoom-auto').getAttribute('aria-pressed'), height: document.getElementById('camera-zoom-auto').getBoundingClientRect().height },
                extrudeAuto: { pressed: document.getElementById('camera-extrude-auto').getAttribute('aria-pressed'), height: document.getElementById('camera-extrude-auto').getBoundingClientRect().height },
                path: document.getElementById('camera-path-output').textContent
            })""")
            check("Motion exposes full camera paths and transforms", len(camera_controls["buttons"]) == 4 and all(button["height"] >= 40 for button in camera_controls["buttons"]) and camera_controls["rotation"] == "0°" and camera_controls["tilt"] == "16°" and camera_controls["zoom"] == "100%" and camera_controls["extrude"] == "0.00" and camera_controls["zoomAuto"]["pressed"] == "false" and camera_controls["extrudeAuto"]["pressed"] == "false" and camera_controls["zoomAuto"]["height"] >= 28 and camera_controls["extrudeAuto"]["height"] >= 28 and camera_controls["path"] == "Manual", str(camera_controls))
            auto_transform_before = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            page.locator('[data-motion-action="toggle-zoom-auto"]').click()
            page.locator('[data-motion-action="toggle-extrude-auto"]').click()
            auto_transform_set = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                zoomPressed: document.getElementById('camera-zoom-auto').getAttribute('aria-pressed'),
                extrudePressed: document.getElementById('camera-extrude-auto').getAttribute('aria-pressed'),
                motionOutput: document.getElementById('motion-preset-output').textContent.trim()
            })""")
            check("Zoom and Extrude expose independent desktop-style Auto controls", auto_transform_set["state"]["autoZoom"] and auto_transform_set["state"]["autoExtrude"] and auto_transform_set["zoomPressed"] == "true" and auto_transform_set["extrudePressed"] == "true" and auto_transform_set["motionOutput"] == "Custom", str(auto_transform_set))
            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.wait_for_function("before => { const m = window.__mobileApp.getMetrics(); return m.autoZoomFrameCount > before.zoom && m.autoExtrudeFrameCount > before.extrude; }", arg={"zoom": auto_transform_before["metrics"]["autoZoomFrameCount"], "extrude": auto_transform_before["metrics"]["autoExtrudeFrameCount"]}, timeout=1500)
            page.wait_for_timeout(420)
            auto_transform_running = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("Zoom and Extrude travel in and out through the runtime motion loop", auto_transform_running["metrics"]["motionActive"] and auto_transform_running["metrics"]["runtimeAnimationActive"] and auto_transform_running["metrics"]["autoZoomFrameCount"] > auto_transform_before["metrics"]["autoZoomFrameCount"] and auto_transform_running["metrics"]["autoExtrudeFrameCount"] > auto_transform_before["metrics"]["autoExtrudeFrameCount"] and abs(auto_transform_running["state"]["zoom"] - auto_transform_before["state"]["zoom"]) > 0.01 and abs(auto_transform_running["state"]["e8MorphT"] - auto_transform_before["state"]["e8MorphT"]) > 0.001 and auto_transform_running["metrics"]["lastDrawStats"]["e8ExtrudedPoints"] == 240 and auto_transform_running["metrics"]["lastDrawStats"]["e8Extrude"] > 0.001, str(auto_transform_running))
            page.evaluate("() => window.__mobileApp.openSettings('motion')")
            page.locator('[data-motion-action="toggle-zoom-auto"]').click()
            page.locator('[data-motion-action="toggle-extrude-auto"]').click()
            auto_transform_stopped = page.evaluate("() => window.__mobileApp.getState()")
            check("Zoom and Extrude Auto controls stop independently", not auto_transform_stopped["autoZoom"] and not auto_transform_stopped["autoExtrude"], str(auto_transform_stopped))
            page.locator('[data-motion-action="camera-dive"]').click()
            dive_camera = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                path: document.getElementById('camera-path-output').textContent,
                pressed: document.querySelector('[data-motion-action="camera-dive"]').getAttribute('aria-pressed'),
                motion: document.getElementById('motion-toggle').checked
            })""")
            check("Dive path starts camera motion without changing models", dive_camera["state"]["cameraPath"] == "dive" and dive_camera["state"]["autoRotate"] and not dive_camera["state"]["autoModel"] and dive_camera["path"] == "Dive" and dive_camera["pressed"] == "true" and dive_camera["motion"], str(dive_camera))
            page.locator('[data-motion-action="camera-reset"]').click()
            camera_reset = page.evaluate("() => window.__mobileApp.getState()")
            check("Camera Reset restores the desktop-like baseline", camera_reset["cameraPath"] == "manual" and not camera_reset["autoRotate"] and not camera_reset["autoZoom"] and not camera_reset["autoExtrude"] and abs(camera_reset["rotation"]) < 0.001 and abs(camera_reset["cameraTilt"] - 0.28) < 0.001 and abs(camera_reset["zoom"] - 1) < 0.001 and camera_reset["e8MorphT"] == 0, str(camera_reset))
            orbit_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('[data-motion-action="orbit"]').click()
            orbit_after = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    motion: document.getElementById('motion-toggle').checked,
                    autoModel: document.getElementById('auto-model-toggle').checked,
                    autoColor: document.getElementById('auto-color-toggle').checked,
                    softFx: document.getElementById('soft-fx-toggle').checked,
                    activeMotion: document.querySelector('#motion-preset-grid button.active')?.dataset.motionAction,
                    motionOutput: document.getElementById('motion-preset-output').textContent.trim()
                }
            })""")
            check("Orbit preset starts current-model rotation only", orbit_after["state"]["autoRotate"] and not orbit_after["state"]["autoModel"] and not orbit_after["state"]["autoColor"] and not orbit_after["state"]["softFx"] and orbit_after["controls"]["motion"] and not orbit_after["controls"]["autoModel"] and orbit_after["controls"]["activeMotion"] == "orbit" and orbit_after["controls"]["motionOutput"] == "Orbit", str(orbit_after))
            check("Orbit preset uses lightweight settings sync", orbit_after["metrics"]["motionPresetSelectCount"] > orbit_before["motionPresetSelectCount"] and orbit_after["metrics"]["motionPresetSyncSkipCount"] > orbit_before["motionPresetSyncSkipCount"] and orbit_after["metrics"]["lastSettingsControlSyncSkip"] == "auto-preset-orbit" and orbit_after["metrics"]["lastMotionPreset"] == "orbit" and orbit_after["metrics"]["controlSyncCount"] == orbit_before["controlSyncCount"], str(orbit_after["metrics"]))
            auto_model_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('[data-motion-action="showcase"]').click()
            auto_model_set = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    motion: document.getElementById('motion-toggle').checked,
                    autoModel: document.getElementById('auto-model-toggle').checked,
                    autoColor: document.getElementById('auto-color-toggle').checked,
                    softFx: document.getElementById('soft-fx-toggle').checked,
                    modelMode: document.getElementById('model-select').value,
                    shape: document.getElementById('shape-select').value,
                    activeMotion: document.querySelector('#motion-preset-grid button.active')?.dataset.motionAction,
                    motionOutput: document.getElementById('motion-preset-output').textContent.trim(),
                    activeFx: document.querySelector('#fx-preset-grid button.active')?.dataset.fxPreset
                }
            })""")
            check("Show preset starts minimal model showcase", auto_model_set["state"]["autoRotate"] and auto_model_set["state"]["autoModel"] and auto_model_set["state"]["autoColor"] and auto_model_set["state"]["softFx"] and auto_model_set["state"]["modelMode"] == "platonic" and auto_model_set["state"]["shape"] == "icosahedron" and auto_model_set["state"]["selectedRoot"] is None and auto_model_set["controls"]["motion"] and auto_model_set["controls"]["autoModel"] and auto_model_set["controls"]["autoColor"] and auto_model_set["controls"]["softFx"] and auto_model_set["controls"]["modelMode"] == "platonic" and auto_model_set["controls"]["shape"] == "icosahedron" and auto_model_set["controls"]["activeMotion"] == "showcase" and auto_model_set["controls"]["motionOutput"] == "Showcase" and auto_model_set["controls"]["activeFx"] == "live" and auto_model_set["metrics"]["lastSettingsControlSyncSkip"] == "auto-preset-showcase", str(auto_model_set))
            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.wait_for_function("before => window.__mobileApp.getMetrics().autoModelSwitchCount > before", arg=auto_model_before["autoModelSwitchCount"], timeout=4000)
            auto_model_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Auto model cycles runtime-only scene modes", auto_model_after["motionActive"] and auto_model_after["runtimeAnimationActive"] and auto_model_after["autoModelFrameCount"] > auto_model_before["autoModelFrameCount"] and auto_model_after["autoModelSwitchCount"] > auto_model_before["autoModelSwitchCount"] and auto_model_after["lastAutoModelTarget"] is not None and auto_model_after["lastModelMode"] == auto_model_after["lastAutoModelTarget"]["modelMode"], str(auto_model_after))
            check("Auto model avoids per-cycle save churn", auto_model_after["saveCount"] <= auto_model_set["metrics"]["saveCount"] + 1, str({"before": auto_model_set["metrics"]["saveCount"], "after": auto_model_after["saveCount"]}))
            page.evaluate("() => window.__mobileApp.openSettings('motion')")
            page.locator('[data-motion-action="still"]').click()
            still_after = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    motion: document.getElementById('motion-toggle').checked,
                    autoModel: document.getElementById('auto-model-toggle').checked,
                    autoColor: document.getElementById('auto-color-toggle').checked,
                    softFx: document.getElementById('soft-fx-toggle').checked,
                    activeMotion: document.querySelector('#motion-preset-grid button.active')?.dataset.motionAction,
                    motionOutput: document.getElementById('motion-preset-output').textContent.trim(),
                    activeFx: document.querySelector('#fx-preset-grid button.active')?.dataset.fxPreset
                }
            })""")
            check("Still preset stops all runtime showcase toggles", not still_after["state"]["autoRotate"] and not still_after["state"]["autoZoom"] and not still_after["state"]["autoExtrude"] and not still_after["state"]["autoModel"] and not still_after["state"]["autoColor"] and not still_after["state"]["softFx"] and not still_after["controls"]["motion"] and not still_after["controls"]["autoModel"] and not still_after["controls"]["autoColor"] and not still_after["controls"]["softFx"] and still_after["controls"]["activeMotion"] == "still" and still_after["controls"]["motionOutput"] == "Still" and still_after["controls"]["activeFx"] == "clean" and still_after["metrics"]["lastSettingsControlSyncSkip"] == "auto-preset-still", str(still_after))
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.forceRender(); }")
            page.evaluate("() => { window.__mobileApp.setState({ autoColor: false, softFx: false, palette: 'cyan' }); window.__mobileApp.forceRender(); window.__mobileApp.openSettings('view'); }")
            surprise_layout = page.evaluate("""() => {
                const surprise = document.getElementById('surprise-button');
                const reset = document.querySelector('[data-action="reset-view"]');
                const done = document.getElementById('settings-done');
                const rect = element => element?.getBoundingClientRect();
                const doneStyle = getComputedStyle(done);
                return {
                    surprise: rect(surprise),
                    reset: rect(reset),
                    done: rect(done),
                    parentClass: surprise?.parentElement?.className,
                    visualDuplicates: document.querySelectorAll('[data-section="style"] #surprise-button').length,
                    action: surprise?.dataset.viewAction,
                    fitAllCount: document.querySelectorAll('[data-view-action="fit-all"]').length,
                    footerCount: document.querySelectorAll('.sheet-footer').length,
                    doneLabel: done?.textContent.trim(),
                    doneBackground: doneStyle.backgroundColor,
                    doneColor: doneStyle.color
                };
            }""")
            check("Surprise sits beside Reset in View", surprise_layout["parentClass"] == "view-actions" and surprise_layout["action"] == "surprise" and surprise_layout["visualDuplicates"] == 0 and surprise_layout["surprise"]["height"] >= 40 and abs(surprise_layout["surprise"]["y"] - surprise_layout["reset"]["y"]) < 1, str(surprise_layout))
            check("Done replaces Fit all above the mobile navigation area", surprise_layout["fitAllCount"] == 0 and surprise_layout["footerCount"] == 0 and surprise_layout["done"]["height"] >= 40 and surprise_layout["done"]["width"] > surprise_layout["surprise"]["width"] * 1.8 and surprise_layout["done"]["y"] > surprise_layout["surprise"]["y"], str(surprise_layout))
            check("Done has a visible yellow treatment", surprise_layout["doneLabel"] == "Done" and surprise_layout["doneBackground"] == "rgb(244, 210, 122)" and surprise_layout["doneColor"] == "rgb(8, 8, 13)", str(surprise_layout))
            surprise_before = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            page.locator("#surprise-button").click()
            surprise_after = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    palette: document.getElementById('palette-select').value,
                    subset: document.getElementById('subset-select').value,
                    pointScale: Number(document.getElementById('point-size').value),
                    rings: document.getElementById('rings-toggle').checked,
                    autoModel: document.getElementById('auto-model-toggle').checked,
                    autoColor: document.getElementById('auto-color-toggle').checked,
                    softFx: document.getElementById('soft-fx-toggle').checked,
                    petrie: document.getElementById('petrie-toggle').checked,
                    mirrors: document.getElementById('mirrors-toggle').checked,
                    edges: document.getElementById('edges-toggle').checked,
                    vertices: document.getElementById('vertices-toggle').checked,
                    motion: document.getElementById('motion-toggle').checked,
                    quality: document.getElementById('quality-chip').textContent
                }
            })""")
            check("Surprise shuffles safe mobile state", surprise_after["state"]["palette"] != surprise_before["state"]["palette"] and surprise_after["state"]["subset"] != surprise_before["state"]["subset"] and surprise_after["state"]["quality"] == "smooth" and not surprise_after["state"]["autoRotate"] and not surprise_after["state"]["autoModel"] and not surprise_after["state"]["autoColor"] and not surprise_after["state"]["softFx"] and surprise_after["state"]["selectedRoot"] is None and abs(surprise_after["state"]["zoom"] - 1) < 0.01 and surprise_after["state"]["panX"] == 0 and surprise_after["state"]["panY"] == 0, str(surprise_after))
            check("Surprise syncs visible controls without full sync", surprise_after["controls"]["palette"] == surprise_after["state"]["palette"] and surprise_after["controls"]["subset"] == surprise_after["state"]["subset"] and abs(surprise_after["controls"]["pointScale"] - surprise_after["state"]["pointScale"]) < 0.01 and surprise_after["controls"]["rings"] == surprise_after["state"]["showRings"] and not surprise_after["controls"]["autoModel"] and not surprise_after["controls"]["autoColor"] and not surprise_after["controls"]["softFx"] and surprise_after["controls"]["petrie"] == surprise_after["state"]["showPetrie"] and surprise_after["controls"]["mirrors"] == surprise_after["state"]["showMirrors"] and not surprise_after["controls"]["vertices"] and not surprise_after["state"]["showVertices"] and not surprise_after["controls"]["motion"] and surprise_after["controls"]["quality"] == "Smooth" and surprise_after["metrics"]["controlSyncCount"] == surprise_before["metrics"]["controlSyncCount"] and surprise_after["metrics"]["settingsControlSyncSkipCount"] > surprise_before["metrics"]["settingsControlSyncSkipCount"] and surprise_after["metrics"]["lastSettingsControlSyncSkip"] == "surprise", str(surprise_after))
            check("Surprise defers hidden render and records telemetry", surprise_after["metrics"]["surpriseCount"] > surprise_before["metrics"]["surpriseCount"] and surprise_after["metrics"]["lastInteractionType"] == "surprise" and surprise_after["metrics"]["lastSurprisePatch"]["palette"] == surprise_after["state"]["palette"] and surprise_after["metrics"]["settingsDeferredRenderRequestCount"] > surprise_before["metrics"]["settingsDeferredRenderRequestCount"] and surprise_after["metrics"]["lastSettingsDeferredRenderReason"] == "surprise" and surprise_after["metrics"]["renderCount"] == surprise_before["metrics"]["renderCount"] and surprise_after["metrics"]["statusText"] == "Surprise ready", str(surprise_after["metrics"]))
            page.evaluate("""() => {
                window.__mobileApp.setState({
                    quality: 'smooth',
                    palette: 'gold',
                    modelMode: 'e8_2d',
                    shape: 'icosahedron',
                    polytope4d: '24cell',
                    dynkinDiagram: 'E8',
                    subset: 'icosahedron',
                    pointScale: 1,
                    showRings: true,
                    showPetrie: false,
                    showMirrors: false,
                    showVertices: false,
                    highlightSubset: true,
                    showContext: true,
                    autoRotate: false,
                    autoModel: false,
                    autoColor: false,
                    softFx: false,
                    rotationSpeed: 0.7,
                    rotation: 0,
                    panX: 0,
                    panY: 0,
                    zoom: 1,
                    selectedRoot: null
                });
                window.__mobileApp.forceRender();
                window.__mobileApp.hideStatus();
                window.__mobileApp.flushSave();
                window.__mobileApp.openSettings('style');
            }""")

            page.evaluate("() => window.__mobileApp.openSettings('quality')")
            hidden_quality_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('[data-quality="sharp"]').click()
            hidden_quality = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("settings quality defers canvas resize", hidden_quality["state"]["quality"] == "sharp" and hidden_quality["metrics"]["settingsCanvasResizeDeferred"] and hidden_quality["metrics"]["settingsCanvasResizeDeferredCount"] > hidden_quality_before["settingsCanvasResizeDeferredCount"] and abs(hidden_quality["metrics"]["renderScale"] - hidden_quality_before["renderScale"]) < 0.01 and hidden_quality["metrics"]["canvas"]["width"] == hidden_quality_before["canvas"]["width"], str(hidden_quality))
            check("settings quality skips full control sync", hidden_quality["metrics"]["settingsControlSyncSkipCount"] > hidden_quality_before["settingsControlSyncSkipCount"] and hidden_quality["metrics"]["lastSettingsControlSyncSkip"] == "quality-setting" and hidden_quality["metrics"]["controlSyncCount"] == hidden_quality_before["controlSyncCount"] and hidden_quality["metrics"]["liveControlSyncSkipCount"] == hidden_quality_before["liveControlSyncSkipCount"] and page.locator('[data-quality="sharp"].active').count() == 1, str(hidden_quality["metrics"]))
            page.locator('[data-quality="sharp"]').click()
            hidden_quality_noop = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("active settings quality skips no-op state work", hidden_quality_noop["settingsStateNoopSkipCount"] > hidden_quality["metrics"]["settingsStateNoopSkipCount"] and hidden_quality_noop["lastSettingsStateNoopSkip"] == "quality-setting" and hidden_quality_noop["settingsCanvasResizeDeferredCount"] == hidden_quality["metrics"]["settingsCanvasResizeDeferredCount"] and hidden_quality_noop["settingsDeferredRenderRequestCount"] == hidden_quality["metrics"]["settingsDeferredRenderRequestCount"] and hidden_quality_noop["settingsControlSyncSkipCount"] == hidden_quality["metrics"]["settingsControlSyncSkipCount"] and hidden_quality_noop["controlSyncCount"] == hidden_quality["metrics"]["controlSyncCount"] and hidden_quality_noop["saveCount"] == hidden_quality["metrics"]["saveCount"], str(hidden_quality_noop))
            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.wait_for_function("count => window.__mobileApp.getMetrics().renderCount > count", arg=hidden_quality["metrics"]["renderCount"])
            hidden_quality_flush = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("settings close applies deferred quality resize", not hidden_quality_flush["settingsCanvasResizeDeferred"] and abs(hidden_quality_flush["renderScale"] - 1.5) < 0.01 and hidden_quality_flush["canvas"]["width"] > hidden_quality_before["canvas"]["width"], str(hidden_quality_flush))
            page.evaluate("""() => {
                window.__mobileApp.openSettings('quality');
                window.__mobileApp.setState({
                    staleExtraKey: 'remove-me',
                    quality: 'sharp',
                    palette: 'ember',
                    modelMode: 'poly4d',
                    polytope4d: '600cell',
                    dynkinDiagram: 'A3',
                    shape: 'dodecahedron',
                    subset: 'dodecahedron',
                    pointScale: 1.5,
                    showRings: false,
                    showPetrie: true,
                    showMirrors: true,
                    showVertices: true,
                    highlightSubset: false,
                    showContext: false,
                    autoRotate: true,
                    autoModel: true,
                    autoColor: true,
                    softFx: true,
                    rotationSpeed: 1.4,
                    selectedRoot: 42,
                    zoom: 2.4,
                    panX: 140,
                    panY: -90,
                    rotation: 0.8
                });
                window.__mobileApp.flushSave();
            }""")
            defaults_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            defaults_button = page.locator("#defaults-button").bounding_box()
            check("Quality section exposes compact Defaults action", bool(defaults_button) and defaults_button["height"] >= 40, str(defaults_button))
            page.locator("#defaults-button").click()
            defaults_after = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                stored: window.__mobileApp.getStoredState(),
                metrics: window.__mobileApp.getMetrics(),
                controls: {
                    quality: document.getElementById('quality-chip').textContent,
                    activeSmooth: document.querySelector('[data-quality="smooth"]').classList.contains('active'),
                    palette: document.getElementById('palette-select').value,
                    modelMode: document.getElementById('model-select').value,
                    polytope4d: document.getElementById('polytope4d-select').value,
                    dynkinDiagram: document.getElementById('dynkin-select').value,
                    subset: document.getElementById('subset-select').value,
                    pointScale: Number(document.getElementById('point-size').value),
                    rings: document.getElementById('rings-toggle').checked,
                    context: document.getElementById('context-toggle').checked,
                    petrie: document.getElementById('petrie-toggle').checked,
                    mirrors: document.getElementById('mirrors-toggle').checked,
                    edges: document.getElementById('edges-toggle').checked,
                    vertices: document.getElementById('vertices-toggle').checked,
                    autoModel: document.getElementById('auto-model-toggle').checked,
                    autoColor: document.getElementById('auto-color-toggle').checked,
                    softFx: document.getElementById('soft-fx-toggle').checked,
                    highlight: document.getElementById('highlight-toggle').checked,
                    motion: document.getElementById('motion-toggle').checked,
                    speed: Number(document.getElementById('motion-speed').value),
                    root: document.getElementById('root-output').textContent,
                    zoom: document.getElementById('zoom-output').textContent
                }
            })""")
            expected_default_state = defaults_after["state"]["quality"] == "smooth" and defaults_after["state"]["palette"] == "gold" and defaults_after["state"]["modelMode"] == "e8_2d" and defaults_after["state"]["shape"] == "icosahedron" and defaults_after["state"]["polytope4d"] == "24cell" and defaults_after["state"]["dynkinDiagram"] == "E8" and defaults_after["state"]["subset"] == "icosahedron" and abs(defaults_after["state"]["pointScale"] - 1) < 0.01 and defaults_after["state"]["showRings"] and defaults_after["state"]["showContext"] and defaults_after["state"]["showEdges"] and defaults_after["state"]["highlightSubset"] and not defaults_after["state"]["showPetrie"] and not defaults_after["state"]["showMirrors"] and not defaults_after["state"]["showVertices"] and not defaults_after["state"]["autoRotate"] and not defaults_after["state"]["autoModel"] and not defaults_after["state"]["autoColor"] and not defaults_after["state"]["softFx"] and defaults_after["state"]["selectedRoot"] is None and abs(defaults_after["state"]["zoom"] - 1) < 0.01 and defaults_after["state"]["panX"] == 0 and defaults_after["state"]["panY"] == 0 and defaults_after["state"]["rotation"] == 0 and "staleExtraKey" not in defaults_after["state"]
            check("Defaults restores exact safe mobile state", expected_default_state, str(defaults_after["state"]))
            check("Defaults syncs controls without full sync", defaults_after["controls"]["quality"] == "Smooth" and defaults_after["controls"]["activeSmooth"] and defaults_after["controls"]["palette"] == "gold" and defaults_after["controls"]["modelMode"] == "e8_2d" and defaults_after["controls"]["polytope4d"] == "24cell" and defaults_after["controls"]["dynkinDiagram"] == "E8" and defaults_after["controls"]["subset"] == "icosahedron" and abs(defaults_after["controls"]["pointScale"] - 1) < 0.01 and defaults_after["controls"]["rings"] and defaults_after["controls"]["context"] and defaults_after["controls"]["edges"] and defaults_after["controls"]["highlight"] and not defaults_after["controls"]["petrie"] and not defaults_after["controls"]["mirrors"] and not defaults_after["controls"]["vertices"] and not defaults_after["controls"]["autoModel"] and not defaults_after["controls"]["autoColor"] and not defaults_after["controls"]["softFx"] and not defaults_after["controls"]["motion"] and abs(defaults_after["controls"]["speed"] - 0.7) < 0.01 and defaults_after["controls"]["root"] == "None" and defaults_after["controls"]["zoom"] == "100%" and defaults_after["metrics"]["controlSyncCount"] == defaults_before["controlSyncCount"] and defaults_after["metrics"]["settingsControlSyncSkipCount"] > defaults_before["settingsControlSyncSkipCount"] and defaults_after["metrics"]["lastSettingsControlSyncSkip"] == "defaults-reset", str(defaults_after))
            check("Defaults rewrites storage and records telemetry", defaults_after["stored"]["palette"] == "gold" and defaults_after["stored"]["quality"] == "smooth" and defaults_after["stored"]["modelMode"] == "e8_2d" and defaults_after["stored"]["polytope4d"] == "24cell" and defaults_after["stored"]["dynkinDiagram"] == "E8" and "staleExtraKey" not in defaults_after["stored"] and defaults_after["metrics"]["defaultsResetCount"] > defaults_before["defaultsResetCount"] and defaults_after["metrics"]["lastInteractionType"] == "defaults-reset" and defaults_after["metrics"]["saveCount"] > defaults_before["saveCount"] and not defaults_after["metrics"]["savePending"] and defaults_after["metrics"]["settingsDeferredRenderRequestCount"] > defaults_before["settingsDeferredRenderRequestCount"] and defaults_after["metrics"]["lastSettingsDeferredRenderReason"] == "defaults-reset" and defaults_after["metrics"]["statusText"] == "Defaults restored", str(defaults_after["metrics"]))
            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.wait_for_function("() => !window.__mobileApp.getMetrics().settingsCanvasResizeDeferred")
            page.evaluate("() => { window.__mobileApp.setState({ quality: 'balanced' }); window.__mobileApp.forceRender(); window.__mobileApp.flushSave(); window.__mobileApp.openSettings('style'); }")
            balanced = page.evaluate("() => window.__mobileApp.getMetrics().renderScale")
            check("quality returns to balanced render scale", abs(balanced - 1.0) < 0.01, str(balanced))
            live_style_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.evaluate(
                """() => {
                    const slider = document.getElementById('point-size');
                    slider.value = '1.5';
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                }"""
            )
            live_style = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("point-size slider previews immediately", abs(live_style["state"]["pointScale"] - 1.5) < 0.01, str(live_style))
            check("point-size preview avoids storage churn", not live_style["metrics"]["savePending"] and live_style["metrics"]["saveCount"] == live_style_before["saveCount"], str(live_style["metrics"]))
            check("point-size preview skips full control sync", live_style["metrics"]["controlSyncCount"] == live_style_before["controlSyncCount"] and live_style["metrics"]["lastLiveControlSyncSkip"] == "point-size-preview", str(live_style["metrics"]))
            check("point-size preview records live control", live_style["metrics"]["lastLiveControl"] == "point-size" and live_style["metrics"]["lastInteractionType"] == "point-size-preview", str(live_style["metrics"]))
            check("point-size preview defers hidden render", live_style["metrics"]["settingsDeferredRenderRequestCount"] > live_style_before["settingsDeferredRenderRequestCount"] and live_style["metrics"]["lastSettingsDeferredRenderReason"] == "point-size-preview" and live_style["metrics"]["renderCount"] == live_style_before["renderCount"] and live_style["metrics"]["liveControlLiteRenderCount"] == live_style_before["liveControlLiteRenderCount"], str(live_style["metrics"]))
            page.evaluate(
                """() => {
                    const slider = document.getElementById('point-size');
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                }"""
            )
            point_commit = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("point-size change commits once", point_commit["savePending"] and point_commit["lastLiveControlCommit"] == "point-size" and point_commit["lastInteractionType"] == "point-size-commit", str(point_commit))
            check("point-size commit defers settled render", point_commit["settledRenderRequestCount"] > live_style["metrics"]["settledRenderRequestCount"] and point_commit["lastSettledRenderRequestReason"] == "point-size-commit" and point_commit["settingsDeferredRenderRequestCount"] > live_style["metrics"]["settingsDeferredRenderRequestCount"] and point_commit["lastSettingsDeferredRenderReason"] == "point-size-commit" and point_commit["renderCount"] == live_style["metrics"]["renderCount"], str(point_commit))
            check("point-size commit can flush", page.evaluate("() => window.__mobileApp.flushSave()"))

            page.evaluate("() => window.__mobileApp.openSettings('motion')")
            motion_speed_grid = page.evaluate("""() => ({
                buttons: [...document.querySelectorAll('#motion-speed-grid [data-motion-speed]')].map(button => ({
                    id: button.dataset.motionSpeed,
                    text: button.textContent.trim(),
                    active: button.classList.contains('active'),
                    pressed: button.getAttribute('aria-pressed')
                })),
                slider: document.getElementById('motion-speed').value,
                output: document.getElementById('motion-speed-output').textContent,
                metrics: window.__mobileApp.getMetrics()
            })""")
            motion_speed_ids = [button["id"] for button in motion_speed_grid["buttons"]]
            check("Motion section exposes compact speed chips", len(motion_speed_grid["buttons"]) == 3 and motion_speed_grid["metrics"]["motionSpeedPresetButtonCount"] == 3 and motion_speed_ids == ["slow", "medium", "fast"], str(motion_speed_grid))
            check("speed chips mark active Medium preset", motion_speed_grid["slider"] == "0.7" and motion_speed_grid["output"] == "Medium" and any(button["id"] == "medium" and button["active"] and button["pressed"] == "true" for button in motion_speed_grid["buttons"]), str(motion_speed_grid))
            motion_speed_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#motion-speed-grid [data-motion-speed="fast"]').click()
            motion_speed_fast = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                slider: document.getElementById('motion-speed').value,
                output: document.getElementById('motion-speed-output').textContent,
                active: [...document.querySelectorAll('#motion-speed-grid [data-motion-speed]')].filter(button => button.classList.contains('active')).map(button => button.dataset.motionSpeed)
            })""")
            check("fast speed chip updates motion speed", abs(motion_speed_fast["state"]["rotationSpeed"] - 1.2) < 0.01 and motion_speed_fast["slider"] == "1.2" and motion_speed_fast["output"] == "Fast" and motion_speed_fast["active"] == ["fast"], str(motion_speed_fast))
            check("fast speed chip skips full control sync", motion_speed_fast["metrics"]["motionSpeedPresetSelectCount"] > motion_speed_before["motionSpeedPresetSelectCount"] and motion_speed_fast["metrics"]["motionSpeedPresetSyncSkipCount"] > motion_speed_before["motionSpeedPresetSyncSkipCount"] and motion_speed_fast["metrics"]["settingsControlSyncSkipCount"] > motion_speed_before["settingsControlSyncSkipCount"] and motion_speed_fast["metrics"]["controlSyncCount"] == motion_speed_before["controlSyncCount"] and motion_speed_fast["metrics"]["lastSettingsControlSyncSkip"] == "motion-speed-preset-fast" and motion_speed_fast["metrics"]["lastMotionSpeedPreset"] == "fast" and abs(motion_speed_fast["metrics"]["lastMotionSpeedPresetValue"] - 1.2) < 0.01, str(motion_speed_fast["metrics"]))
            check("fast speed chip suppresses hidden render", motion_speed_fast["metrics"]["renderSuppressedCount"] > motion_speed_before["renderSuppressedCount"] and motion_speed_fast["metrics"]["lastRenderSuppressedReason"] == "motion-speed-preset-fast", str(motion_speed_fast["metrics"]))
            check("motion speed preset can flush", page.evaluate("() => window.__mobileApp.flushSave()"))
            live_motion_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.evaluate(
                """() => {
                    const slider = document.getElementById('motion-speed');
                    slider.value = '1.4';
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                }"""
            )
            live_motion = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("motion-speed slider previews immediately", abs(live_motion["state"]["rotationSpeed"] - 1.4) < 0.01, str(live_motion))
            check("motion-speed preview avoids storage churn", not live_motion["metrics"]["savePending"] and live_motion["metrics"]["saveCount"] == live_motion_before["saveCount"], str(live_motion["metrics"]))
            check("motion-speed preview skips full control sync", live_motion["metrics"]["controlSyncCount"] == live_motion_before["controlSyncCount"] and live_motion["metrics"]["lastLiveControlSyncSkip"] == "motion-speed-preview", str(live_motion["metrics"]))
            check("motion-speed preview suppresses hidden render", live_motion["metrics"]["renderSuppressedCount"] > live_motion_before["renderSuppressedCount"] and live_motion["metrics"]["lastRenderSuppressedReason"] == "motion-speed-preview" and live_motion["metrics"]["renderCount"] == live_motion_before["renderCount"] and live_motion["metrics"]["liveControlLiteRenderCount"] == live_motion_before["liveControlLiteRenderCount"], str(live_motion["metrics"]))
            live_motion_controls = page.evaluate("""() => ({
                output: document.getElementById('motion-speed-output').textContent,
                active: [...document.querySelectorAll('#motion-speed-grid [data-motion-speed]')].filter(button => button.classList.contains('active')).map(button => button.dataset.motionSpeed)
            })""")
            check("motion-speed slider clears preset chip state", live_motion_controls["output"] == "1.4x" and live_motion_controls["active"] == [], str(live_motion_controls))
            page.evaluate(
                """() => {
                    const slider = document.getElementById('motion-speed');
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                }"""
            )
            motion_commit = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("motion-speed change commits once", motion_commit["savePending"] and motion_commit["lastLiveControlCommit"] == "motion-speed" and motion_commit["lastInteractionType"] == "motion-speed-commit", str(motion_commit))
            check("motion-speed commit suppresses hidden render", motion_commit["renderSuppressedCount"] > live_motion["metrics"]["renderSuppressedCount"] and motion_commit["lastRenderSuppressedReason"] == "motion-speed-commit" and motion_commit["renderCount"] == live_motion["metrics"]["renderCount"], str(motion_commit))
            check("motion-speed commit can flush", page.evaluate("() => window.__mobileApp.flushSave()"))

            page.evaluate("() => window.__mobileApp.openSettings('view')")
            subset_chip_grid = page.evaluate("""() => ({
                buttons: [...document.querySelectorAll('#subset-chip-grid [data-subset-chip]')].map(button => ({
                    id: button.dataset.subsetChip,
                    text: button.textContent.trim(),
                    active: button.classList.contains('active'),
                    pressed: button.getAttribute('aria-pressed')
                })),
                select: document.getElementById('subset-select').value,
                output: document.getElementById('subset-output').textContent,
                metrics: window.__mobileApp.getMetrics()
            })""")
            subset_chip_ids = [button["id"] for button in subset_chip_grid["buttons"]]
            check("View section exposes compact subset chips", len(subset_chip_grid["buttons"]) == 3 and subset_chip_grid["metrics"]["subsetChipButtonCount"] == 3 and subset_chip_ids == ["icosahedron", "dodecahedron", "simple_roots"], str(subset_chip_grid))
            check("subset chips mark active Icosahedron subset", subset_chip_grid["select"] == "icosahedron" and any(button["id"] == "icosahedron" and button["active"] and button["pressed"] == "true" for button in subset_chip_grid["buttons"]), str(subset_chip_grid))
            subset_chip_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#subset-chip-grid [data-subset-chip="dodecahedron"]').click()
            subset_chip_metrics = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                label: document.getElementById('subset-output').textContent,
                controls: {
                    select: document.getElementById('subset-select').value,
                    activeChip: document.querySelector('#subset-chip-grid button.active')?.dataset.subsetChip
                }
            })""")
            check("subset chip changes state and controls", subset_chip_metrics["state"]["subset"] == "dodecahedron" and subset_chip_metrics["label"] == "28 roots" and subset_chip_metrics["controls"]["select"] == "dodecahedron" and subset_chip_metrics["controls"]["activeChip"] == "dodecahedron", str(subset_chip_metrics))
            check("subset chip uses lightweight settings sync", subset_chip_metrics["metrics"]["subsetChipSelectCount"] > subset_chip_before["subsetChipSelectCount"] and subset_chip_metrics["metrics"]["subsetChipSyncSkipCount"] > subset_chip_before["subsetChipSyncSkipCount"] and subset_chip_metrics["metrics"]["settingsControlSyncSkipCount"] > subset_chip_before["settingsControlSyncSkipCount"] and subset_chip_metrics["metrics"]["lastSettingsControlSyncSkip"] == "subset-chip-dodecahedron" and subset_chip_metrics["metrics"]["controlSyncCount"] == subset_chip_before["controlSyncCount"] and subset_chip_metrics["metrics"]["subsetControlSyncCount"] > subset_chip_before["subsetControlSyncCount"], str(subset_chip_metrics["metrics"]))
            page.evaluate("() => window.__mobileApp.selectSubsetChip('icosahedron')")
            subset_select_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#subset-select").select_option("dodecahedron")
            subset_select_metrics = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                label: document.getElementById('subset-output').textContent,
                activeChip: document.querySelector('#subset-chip-grid button.active')?.dataset.subsetChip
            })""")
            check("subset picker changes state", subset_select_metrics["state"]["subset"] == "dodecahedron", str(subset_select_metrics))
            check("subset picker updates visible count", subset_select_metrics["label"] == "28 roots", str(subset_select_metrics))
            check("subset picker syncs active chip", subset_select_metrics["activeChip"] == "dodecahedron", str(subset_select_metrics))
            check("subset picker skips full control sync", subset_select_metrics["metrics"]["settingsControlSyncSkipCount"] > subset_select_before["settingsControlSyncSkipCount"] and subset_select_metrics["metrics"]["lastSettingsControlSyncSkip"] == "subset-select" and subset_select_metrics["metrics"]["controlSyncCount"] == subset_select_before["controlSyncCount"] and subset_select_metrics["metrics"]["subsetControlSyncCount"] > subset_select_before["subsetControlSyncCount"], str(subset_select_metrics["metrics"]))
            check("subset picker defers hidden render", subset_select_metrics["metrics"]["settingsDeferredRenderRequestCount"] > subset_select_before["settingsDeferredRenderRequestCount"] and subset_select_metrics["metrics"]["lastSettingsDeferredRenderReason"] == "subset-select" and subset_select_metrics["metrics"]["renderCount"] == subset_select_before["renderCount"], str(subset_select_metrics["metrics"]))
            page.locator("#subset-select").select_option("icosahedron")
            check("subset picker reports 12 roots", page.locator("#subset-output").inner_text() == "12 roots")
            simple_subset_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#subset-select").select_option("simple_roots")
            simple_subset = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics(), label: document.getElementById('subset-output').textContent })")
            check("simple roots subset changes state", simple_subset["state"]["subset"] == "simple_roots", str(simple_subset))
            check("simple roots subset reports 8 roots", simple_subset["label"] == "8 roots" and simple_subset["metrics"]["subsetSize"] == 8 and simple_subset["metrics"]["simpleRootCount"] == 8, str(simple_subset))
            check("simple roots picker skips full control sync", simple_subset["metrics"]["settingsControlSyncSkipCount"] > simple_subset_before["settingsControlSyncSkipCount"] and simple_subset["metrics"]["lastSettingsControlSyncSkip"] == "subset-select" and simple_subset["metrics"]["controlSyncCount"] == simple_subset_before["controlSyncCount"], str(simple_subset["metrics"]))
            page.locator('[data-subset-action="first"]').click()
            simple_first = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics(), label: document.getElementById('subset-output').textContent })")
            check("simple roots first selects alpha one root", simple_first["state"]["selectedRoot"] == 0 and simple_first["metrics"]["subsetIndex"] == 0 and simple_first["label"] == "1/8", str(simple_first))
            check("simple roots first exposes alpha label", simple_first["metrics"]["selectedContext"]["simpleRootOrder"] == 1 and simple_first["metrics"]["selectedContext"]["simpleRootLabel"] == "alpha 1" and "Root #0 (alpha 1)" in page.locator("#root-drawer").inner_text(), str(simple_first))
            page.locator('[data-subset-action="next"]').click()
            simple_next = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics(), label: document.getElementById('subset-output').textContent })")
            check("simple roots next follows alpha order", simple_next["state"]["selectedRoot"] == 6 and simple_next["metrics"]["subsetIndex"] == 1 and simple_next["label"] == "2/8", str(simple_next))
            check("simple roots next exposes alpha label", simple_next["metrics"]["selectedContext"]["simpleRootOrder"] == 2 and simple_next["metrics"]["selectedContext"]["simpleRootLabel"] == "alpha 2" and "Root #6 (alpha 2)" in page.locator("#root-drawer").inner_text(), str(simple_next))
            relation = simple_next["metrics"]["selectedRelation"]
            check("successive simple roots expose Cartan relation", relation["from"] == 0 and relation["to"] == 6 and relation["dot"] == -1 and relation["relation"] == "Cartan edge", str(relation))
            relation_text = page.evaluate("() => document.getElementById('info-selection').textContent")
            check("Info detail shows previous-root relation", "From #0: dot -1 | Cartan edge" in relation_text, relation_text)
            page.locator('[data-subset-action="frame"]').click()
            page.evaluate("() => window.__mobileApp.forceRender()")
            simple_frame = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("simple roots frame fits visible bounds", simple_frame["subsetFrame"]["withinView"], str(simple_frame["subsetFrame"]))
            page.locator("#subset-select").select_option("icosahedron")
            check("subset picker returns to Icosahedron roots", page.locator("#subset-output").inner_text() == "7/12")
            check("subset picker change persists", page.evaluate("""() => {
                window.__mobileApp.flushSave();
                return window.__mobileApp.getStoredState()?.subset === 'icosahedron';
            }"""))
            petrie_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#petrie-toggle").check()
            petrie_deferred = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("Petrie toggle changes state", petrie_deferred["state"]["showPetrie"], str(petrie_deferred))
            check("Petrie toggle skips full control sync", petrie_deferred["metrics"]["settingsControlSyncSkipCount"] > petrie_before["settingsControlSyncSkipCount"] and petrie_deferred["metrics"]["lastSettingsControlSyncSkip"] == "petrie-toggle" and petrie_deferred["metrics"]["controlSyncCount"] == petrie_before["controlSyncCount"], str(petrie_deferred["metrics"]))
            check("Petrie toggle defers hidden render", petrie_deferred["metrics"]["settingsDeferredRenderRequestCount"] > petrie_before["settingsDeferredRenderRequestCount"] and petrie_deferred["metrics"]["lastSettingsDeferredRenderReason"] == "petrie-toggle" and petrie_deferred["metrics"]["renderCount"] == petrie_before["renderCount"], str(petrie_deferred["metrics"]))
            page.evaluate("() => window.__mobileApp.forceRender()")
            petrie_on = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Petrie cycle draws 30-segment path", petrie_on["petrieCycleLength"] == 30 and petrie_on["lastDrawStats"]["petrieSegments"] == 30 and petrie_on["lastDrawStats"]["petrieStrokes"] == 1 and petrie_on["lastDrawStats"]["petriePoints"] == 30, str(petrie_on))
            page.locator("#petrie-toggle").uncheck()
            page.evaluate("() => window.__mobileApp.forceRender()")
            petrie_off = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Petrie cycle hides cleanly", not page.evaluate("() => window.__mobileApp.getState().showPetrie") and petrie_off["lastDrawStats"]["petrieSegments"] == 0 and petrie_off["lastDrawStats"]["petriePoints"] == 0, str(petrie_off["lastDrawStats"]))
            petrie_save = page.evaluate("""() => {
                const flushed = window.__mobileApp.flushSave();
                const state = window.__mobileApp.getState();
                const stored = window.__mobileApp.getStoredState();
                return { flushed, stateValue: state.showPetrie, storedValue: stored?.showPetrie };
            }""")
            check("Petrie toggle persists", (petrie_save["flushed"] or petrie_save["storedValue"] == petrie_save["stateValue"]) and petrie_save["storedValue"] is False, str(petrie_save))
            mirrors_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#mirrors-toggle").check()
            mirrors_deferred = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("Weyl mirrors toggle changes state", mirrors_deferred["state"]["showMirrors"], str(mirrors_deferred))
            check("Weyl mirrors toggle skips full control sync", mirrors_deferred["metrics"]["settingsControlSyncSkipCount"] > mirrors_before["settingsControlSyncSkipCount"] and mirrors_deferred["metrics"]["lastSettingsControlSyncSkip"] == "mirrors-toggle" and mirrors_deferred["metrics"]["controlSyncCount"] == mirrors_before["controlSyncCount"], str(mirrors_deferred["metrics"]))
            check("Weyl mirrors toggle defers hidden render", mirrors_deferred["metrics"]["settingsDeferredRenderRequestCount"] > mirrors_before["settingsDeferredRenderRequestCount"] and mirrors_deferred["metrics"]["lastSettingsDeferredRenderReason"] == "mirrors-toggle" and mirrors_deferred["metrics"]["renderCount"] == mirrors_before["renderCount"], str(mirrors_deferred["metrics"]))
            page.evaluate("() => window.__mobileApp.forceRender()")
            mirrors_on = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Weyl mirrors draw eight batched lines", mirrors_on["simpleRootCount"] == 8 and mirrors_on["lastDrawStats"]["mirrorLines"] == 8 and mirrors_on["lastDrawStats"]["mirrorStrokes"] == 1, str(mirrors_on))
            page.locator("#mirrors-toggle").uncheck()
            page.evaluate("() => window.__mobileApp.forceRender()")
            mirrors_off = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("Weyl mirrors hide cleanly", not page.evaluate("() => window.__mobileApp.getState().showMirrors") and mirrors_off["lastDrawStats"]["mirrorLines"] == 0 and mirrors_off["lastDrawStats"]["mirrorStrokes"] == 0, str(mirrors_off["lastDrawStats"]))
            mirrors_save = page.evaluate("""() => {
                const flushed = window.__mobileApp.flushSave();
                const state = window.__mobileApp.getState();
                const stored = window.__mobileApp.getStoredState();
                return { flushed, stateValue: state.showMirrors, storedValue: stored?.showMirrors };
            }""")
            check("Weyl mirrors toggle persists", (mirrors_save["flushed"] or mirrors_save["storedValue"] == mirrors_save["stateValue"]) and mirrors_save["storedValue"] is False, str(mirrors_save))
            page.locator('[data-subset-action="first"]').click()
            first_subset = page.evaluate("() => ({state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics(), label: document.getElementById('subset-output').textContent})")
            check("subset first selects first subset root", first_subset["metrics"]["subsetSize"] == 12 and first_subset["metrics"]["subsetIndex"] == 0, str(first_subset))
            check("subset output shows first position", first_subset["label"] == "1/12", str(first_subset))
            page.locator('[data-subset-action="next"]').click()
            check("subset next advances within subset", page.evaluate("() => window.__mobileApp.getMetrics().subsetIndex") == 1)
            page.locator('[data-subset-action="prev"]').click()
            check("subset previous returns within subset", page.evaluate("() => window.__mobileApp.getMetrics().subsetIndex") == 0)
            page.evaluate("() => window.__mobileApp.setState({ subset: 'dodecahedron', selectedRoot: null, zoom: 0.58, panX: 120, panY: -90, rotation: 0.25 })")
            page.locator('[data-subset-action="frame"]').click()
            page.evaluate("() => window.__mobileApp.forceRender()")
            framed_subset = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("subset frame fits visible bounds", framed_subset["metrics"]["subsetFrame"]["withinView"], str(framed_subset["metrics"]["subsetFrame"]))
            check("subset frame updates zoom", abs(framed_subset["state"]["zoom"] - 0.58) > 0.05, str(framed_subset["state"]))
            check("subset frame telemetry records action", framed_subset["metrics"]["lastInteractionType"] == "frame-subset", str(framed_subset["metrics"]))
            page.evaluate("() => window.__mobileApp.setState({ zoom: 2.4, panX: -260, panY: 180, rotation: 0.4, selectedRoot: null })")
            before_fit_all = page.evaluate("() => window.__mobileApp.getMetrics().allFrame")
            check("dirty all-roots frame starts outside view", not before_fit_all["withinView"], str(before_fit_all))
            page.evaluate("() => window.__mobileApp.fitAllRoots()")
            page.evaluate("() => window.__mobileApp.forceRender()")
            fit_all = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("fit all fits visible bounds", fit_all["metrics"]["allFrame"]["withinView"], str(fit_all["metrics"]["allFrame"]))
            check("fit all updates zoom", abs(fit_all["state"]["zoom"] - 2.4) > 0.05, str(fit_all["state"]))
            check("fit all telemetry records action", fit_all["metrics"]["lastInteractionType"] == "fit-all", str(fit_all["metrics"]))
            projected_model_fits = page.evaluate("""() => {
                const app = window.__mobileApp;
                const targets = [
                    { id: 'shape-dodecahedron', mode: 'platonic' },
                    { id: 'poly-24cell', mode: 'poly4d' },
                    { id: 'dynkin-E7', mode: 'dynkin' },
                    { id: 'bloom', mode: 'bloom' }
                ];
                return targets.map(target => {
                    app.selectModelShortcut(target.id);
                    app.setState({ zoom: 2.65, panX: 280, panY: -240, autoRotate: false });
                    app.forceRender();
                    const before = app.getMetrics().allFrame;
                    app.fitAllRoots();
                    app.forceRender();
                    const after = app.getMetrics();
                    return {
                        id: target.id,
                        mode: target.mode,
                        before,
                        frame: after.allFrame,
                        renderedMode: after.lastModelMode,
                        state: app.getState()
                    };
                });
            }""")
            check("Fit All uses each active model's projected bounds", all(result["renderedMode"] == result["mode"] and result["frame"]["withinView"] and abs(result["state"]["zoom"] - 2.65) > 0.05 for result in projected_model_fits), str(projected_model_fits))
            page.evaluate("() => { window.__mobileApp.selectModelShortcut('e8_2d'); window.__mobileApp.openSettings('view'); }")
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.setState({ zoom: 2.2, panX: 230, panY: -210, rotation: 0.55, selectedRoot: null, autoRotate: false }); window.__mobileApp.forceRender(); }")
            before_double_tap = page.evaluate("() => window.__mobileApp.getMetrics().allFrame")
            check("dirty double-tap frame starts outside view", not before_double_tap["withinView"], str(before_double_tap))
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, id) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: id,
                        pointerType: 'touch',
                        clientX: 205,
                        clientY: 454,
                        isPrimary: true,
                    }));
                    fire('pointerdown', 21);
                    fire('pointerup', 21);
                    fire('pointerdown', 22);
                    fire('pointerup', 22);
                }"""
            )
            page.evaluate("() => window.__mobileApp.forceRender()")
            double_tap_fit = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics() })")
            check("double tap fits all roots", double_tap_fit["metrics"]["allFrame"]["withinView"], str(double_tap_fit["metrics"]["allFrame"]))
            check("double tap clears incidental selection", double_tap_fit["state"]["selectedRoot"] is None, str(double_tap_fit["state"]))
            check("double tap fit telemetry records gesture", double_tap_fit["metrics"]["lastInteractionType"] == "double-tap-fit-all", str(double_tap_fit["metrics"]))
            check("double tap shows fit status", double_tap_fit["metrics"]["statusVisible"] and double_tap_fit["metrics"]["statusText"] == "View fitted", str(double_tap_fit["metrics"]))
            page.evaluate("() => window.__mobileApp.hideStatus()")
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            page.evaluate("() => window.__mobileApp.flushSave()")
            root_scrub_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.evaluate(
                """() => {
                    const range = document.getElementById('root-range');
                    range.value = '42';
                    range.dispatchEvent(new Event('input', { bubbles: true }));
                }"""
            )
            check("root browser slider selects root", page.evaluate("() => window.__mobileApp.getState().selectedRoot") == 42)
            check("root browser output updates", page.locator("#root-output").inner_text() == "#42")
            root_scrub_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("root browser scrub avoids storage churn", not root_scrub_metrics["savePending"] and root_scrub_metrics["saveCount"] == root_scrub_before["saveCount"], str(root_scrub_metrics))
            check("root browser scrub records live control", root_scrub_metrics["lastLiveControl"] == "root-scrub" and root_scrub_metrics["lastInteractionType"] == "root-scrub", str(root_scrub_metrics))
            check("root browser scrub defers hidden render", root_scrub_metrics["settingsDeferredRenderRequestCount"] > root_scrub_before["settingsDeferredRenderRequestCount"] and root_scrub_metrics["lastSettingsDeferredRenderReason"] == "root-scrub" and root_scrub_metrics["renderCount"] == root_scrub_before["renderCount"] and root_scrub_metrics["liveControlLiteRenderCount"] == root_scrub_before["liveControlLiteRenderCount"], str(root_scrub_metrics))
            check("root browser scrub uses lightweight selection UI", root_scrub_metrics["selectionUiLiteUpdateCount"] > root_scrub_before["selectionUiLiteUpdateCount"] and root_scrub_metrics["selectionUiFullUpdateCount"] == root_scrub_before["selectionUiFullUpdateCount"] and root_scrub_metrics["lastSelectionUiMode"] == "lite" and root_scrub_metrics["lastSelectionUiReason"] == "root-scrub" and root_scrub_metrics["selectionUiDetailsDeferred"], str(root_scrub_metrics))
            page.evaluate(
                """() => {
                    const range = document.getElementById('root-range');
                    range.dispatchEvent(new Event('change', { bubbles: true }));
                }"""
            )
            root_commit_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("root browser change commits once", root_commit_metrics["savePending"] and root_commit_metrics["lastLiveControlCommit"] == "root-scrub" and root_commit_metrics["lastInteractionType"] == "root-commit", str(root_commit_metrics))
            check("root browser commit defers settled render", root_commit_metrics["settledRenderRequestCount"] > root_scrub_metrics["settledRenderRequestCount"] and root_commit_metrics["lastSettledRenderRequestReason"] == "root-commit" and root_commit_metrics["settingsDeferredRenderRequestCount"] > root_scrub_metrics["settingsDeferredRenderRequestCount"] and root_commit_metrics["lastSettingsDeferredRenderReason"] == "root-commit" and root_commit_metrics["renderCount"] == root_scrub_metrics["renderCount"], str(root_commit_metrics))
            check("root browser commit restores full selection UI", root_commit_metrics["selectionUiFullUpdateCount"] > root_scrub_metrics["selectionUiFullUpdateCount"] and root_commit_metrics["lastSelectionUiMode"] == "full" and root_commit_metrics["lastSelectionUiReason"] == "root-commit" and not root_commit_metrics["selectionUiDetailsDeferred"], str(root_commit_metrics))
            check("root browser commit can flush", page.evaluate("() => window.__mobileApp.flushSave()"))
            root_jump_grid = page.evaluate("""() => ({
                buttons: [...document.querySelectorAll('#root-jump-grid [data-root-jump]')].map(button => ({
                    id: button.dataset.rootJump,
                    text: button.textContent.trim(),
                    disabled: button.disabled,
                    ariaDisabled: button.getAttribute('aria-disabled')
                })),
                output: document.getElementById('root-jump-output').textContent.trim(),
                metrics: window.__mobileApp.getMetrics()
            })""")
            root_jump_ids = [button["id"] for button in root_jump_grid["buttons"]]
            check("Root browser exposes compact jump shortcuts", len(root_jump_grid["buttons"]) == 5 and root_jump_grid["metrics"]["rootJumpButtonCount"] == 5 and root_jump_ids == ["alpha", "mckay", "near", "opposite", "random"], str(root_jump_grid))
            check("Root jumps enable context buttons for selected root", root_jump_grid["output"] == "#42" and all(not button["disabled"] and button["ariaDisabled"] == "false" for button in root_jump_grid["buttons"]), str(root_jump_grid))
            root_jump_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator('#root-jump-grid [data-root-jump="alpha"]').click()
            alpha_jump = page.evaluate("""() => ({
                state: window.__mobileApp.getState(),
                metrics: window.__mobileApp.getMetrics(),
                rootOutput: document.getElementById('root-output').textContent.trim(),
                jumpOutput: document.getElementById('root-jump-output').textContent.trim(),
                subsetOutput: document.getElementById('subset-output').textContent.trim(),
                subsetSelect: document.getElementById('subset-select').value
            })""")
            check("Alpha root jump selects first simple root", alpha_jump["state"]["selectedRoot"] == 0 and alpha_jump["state"]["subset"] == "simple_roots" and alpha_jump["rootOutput"] == "#0" and alpha_jump["jumpOutput"] == "#0" and alpha_jump["subsetOutput"] == "1/8" and alpha_jump["subsetSelect"] == "simple_roots", str(alpha_jump))
            check("Alpha root jump records telemetry", alpha_jump["metrics"]["rootJumpSelectCount"] > root_jump_before["rootJumpSelectCount"] and alpha_jump["metrics"]["rootJumpSubsetSwitchCount"] > root_jump_before["rootJumpSubsetSwitchCount"] and alpha_jump["metrics"]["lastRootJump"] == "alpha" and alpha_jump["metrics"]["lastRootJumpRoot"] == 0 and alpha_jump["metrics"]["lastInteractionType"] == "root-jump-alpha", str(alpha_jump["metrics"]))
            near_before = page.evaluate("() => ({ metrics: window.__mobileApp.getMetrics(), selected: window.__mobileApp.getState().selectedRoot })")
            page.locator('#root-jump-grid [data-root-jump="near"]').click()
            near_jump = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics(), output: document.getElementById('root-jump-output').textContent.trim() })")
            check("Near root jump selects a Cartan neighbor", near_jump["state"]["selectedRoot"] != near_before["selected"] and near_jump["metrics"]["selectedRelation"]["relation"] == "Cartan edge" and near_jump["metrics"]["lastRootJump"] == "near" and near_jump["metrics"]["lastInteractionType"] == "root-jump-near" and near_jump["output"] == f"#{near_jump['state']['selectedRoot']}", str(near_jump))
            opposite_target = page.evaluate("() => window.__mobileApp.getMetrics().selectedContext.antipode")
            page.locator('#root-jump-grid [data-root-jump="opposite"]').click()
            opposite_jump = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics(), output: document.getElementById('root-jump-output').textContent.trim() })")
            check("Opposite root jump selects antipode", opposite_jump["state"]["selectedRoot"] == opposite_target and opposite_jump["metrics"]["lastRootJump"] == "opposite" and opposite_jump["metrics"]["lastRootJumpRoot"] == opposite_target and opposite_jump["output"] == f"#{opposite_target}", str(opposite_jump))
            random_before = opposite_jump["state"]["selectedRoot"]
            page.locator('#root-jump-grid [data-root-jump="random"]').click()
            random_jump = page.evaluate("() => ({ state: window.__mobileApp.getState(), metrics: window.__mobileApp.getMetrics(), output: document.getElementById('root-jump-output').textContent.trim() })")
            check("Random root jump selects a different valid root", random_jump["state"]["selectedRoot"] != random_before and 0 <= random_jump["state"]["selectedRoot"] < 240 and random_jump["metrics"]["lastRootJump"] == "random" and random_jump["metrics"]["lastRootJumpRoot"] == random_jump["state"]["selectedRoot"] and random_jump["output"] == f"#{random_jump['state']['selectedRoot']}", str(random_jump))
            page.evaluate("() => window.__mobileApp.clearSelection()")
            root_jump_cleared = page.evaluate("""() => ({
                disabled: [...document.querySelectorAll('#root-jump-grid [data-root-jump]')].filter(button => button.disabled).map(button => button.dataset.rootJump),
                output: document.getElementById('root-jump-output').textContent.trim(),
                before: window.__mobileApp.getMetrics().rootJumpDisabledCount,
                result: window.__mobileApp.selectRootJump('near'),
                after: window.__mobileApp.getMetrics().rootJumpDisabledCount,
                statusText: window.__mobileApp.getMetrics().statusText
            })""")
            check("Root jumps disable context actions with no selection", root_jump_cleared["disabled"] == ["near", "opposite"] and root_jump_cleared["output"] == "None" and not root_jump_cleared["result"] and root_jump_cleared["after"] > root_jump_cleared["before"] and root_jump_cleared["statusText"] == "Select a root first", str(root_jump_cleared))
            page.evaluate("() => { window.__mobileApp.setState({ subset: 'icosahedron', selectedRoot: 42 }); window.__mobileApp.forceRender(); window.__mobileApp.flushSave(); window.__mobileApp.openSettings('view'); }")
            page.locator('[data-root-action="next"]').click()
            check("root browser next advances", page.evaluate("() => window.__mobileApp.getState().selectedRoot") == 43)
            page.locator('[data-root-action="prev"]').click()
            check("root browser previous returns", page.evaluate("() => window.__mobileApp.getState().selectedRoot") == 42)
            page.evaluate("() => { window.__mobileApp.forceRender(); window.__mobileApp.flushSave(); }")
            same_root_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.evaluate("() => window.__mobileApp.selectRoot(42)")
            same_root_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("same root selection skips no-op state work", same_root_after["selectionStateNoopSkipCount"] > same_root_before["selectionStateNoopSkipCount"] and same_root_after["lastSelectionStateNoopSkip"] == "select-root" and same_root_after["lastSelectionStateNoopRoot"] == 42 and same_root_after["renderCount"] == same_root_before["renderCount"] and same_root_after["saveCount"] == same_root_before["saveCount"] and same_root_after["selectionUiFullUpdateCount"] == same_root_before["selectionUiFullUpdateCount"] and same_root_after["selectionUiFullDomWriteCount"] == same_root_before["selectionUiFullDomWriteCount"] and same_root_after["selectionUiFullDomSkipCount"] == same_root_before["selectionUiFullDomSkipCount"], str(same_root_after))
            page.locator('.browse-panel [data-root-action="center"]').click()
            page.evaluate("() => window.__mobileApp.forceRender()")
            check("root browser center keeps selection", page.evaluate("() => window.__mobileApp.getState().selectedRoot") == 42)
            page.evaluate("() => window.__mobileApp.selectAdjacentRoot(1)")
            check("debug adjacent root advances", page.evaluate("() => window.__mobileApp.getState().selectedRoot") == 43)
            page.get_by_role("button", name="In", exact=True).click()
            zoom_after_in = page.evaluate("() => window.__mobileApp.getState().zoom")
            check("zoom in button increases zoom", zoom_after_in > 1, str(zoom_after_in))
            check("zoom output updates after in", page.locator("#zoom-output").inner_text() == f"{round(zoom_after_in * 100)}%")
            page.get_by_role("button", name="100%", exact=True).click()
            check("zoom reset button returns to 100%", abs(page.evaluate("() => window.__mobileApp.getState().zoom") - 1) < 0.01)
            page.evaluate("() => window.__mobileApp.stepZoom(-1)")
            zoom_after_out = page.evaluate("() => window.__mobileApp.getState().zoom")
            check("debug zoom step decreases zoom", zoom_after_out < 1, str(zoom_after_out))
            page.evaluate("() => window.__mobileApp.setZoom(1)")
            context_toggle_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.locator("#context-toggle").uncheck()
            page.evaluate("() => window.__mobileApp.forceRender()")
            no_context_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("context toggle skips full control sync", no_context_metrics["settingsControlSyncSkipCount"] > context_toggle_before["settingsControlSyncSkipCount"] and no_context_metrics["lastSettingsControlSyncSkip"] == "context-toggle" and no_context_metrics["controlSyncCount"] == context_toggle_before["controlSyncCount"] and no_context_metrics["liveControlSyncSkipCount"] == context_toggle_before["liveControlSyncSkipCount"], str(no_context_metrics))
            check("context toggle disables context visuals", not no_context_metrics["contextVisible"], str(no_context_metrics))
            check("context-off draw skips ray stroke", no_context_metrics["lastDrawStats"]["rays"] == 0 and no_context_metrics["lastDrawStats"]["rayStrokes"] == 0, str(no_context_metrics["lastDrawStats"]))
            page.locator("#context-toggle").check()
            page.evaluate("() => window.__mobileApp.forceRender()")
            context_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            context_draw = context_metrics["lastDrawStats"]
            check("context toggle enables context visuals", context_metrics["contextVisible"], str(context_metrics))
            check("context rays are batched into one stroke", context_draw["rays"] == 56 and context_draw["rayStrokes"] == 1, str(context_draw))
            check("context draw records highlighted points", context_draw["points"] == 240 and context_draw["neighborPoints"] == 56 and context_draw["selectedPoints"] == 1, str(context_draw))
            check("context draw keeps ordinary points batched", context_draw["batchedPoints"] + context_draw["directPoints"] == 240 and context_draw["pointBatchFills"] <= 5 and context_draw["directPoints"] == context_draw["glowPoints"], str(context_draw))
            check("context draw uses reusable point queues", context_draw["drawMaskWrites"] == 240 and context_draw["directQueuePoints"] == context_draw["directPoints"] == context_draw["glowPoints"] and context_draw["directPointObjectAllocs"] == 0 and context_draw["baseBucketCount"] == context_draw["pointBatchFills"] == 5, str(context_draw))
            check("context draw uses cached alpha colors", context_draw["alphaColorCacheHits"] == context_draw["directPoints"] + 2 and context_draw["alphaColorRuntimeParses"] == 0, str(context_draw))
            check("context draw uses precomputed geometry", context_draw["baseSizeCacheHits"] == 240 and context_draw["fillSlotCacheHits"] == context_draw["batchedPoints"] and context_draw["ringScaleFactors"] == context_draw["rings"], str(context_draw))
            check("context draw projects directly into point cache", context_draw["projectedPoints"] == 240 and context_draw["projectionObjectAllocs"] == 0 and context_metrics["lastProjectionSource"] == "direct-point-fields" and context_metrics["lastProjectionCount"] == 240, str(context_metrics))

            jitter_probe = page.evaluate(
                """async () => {
                    const app = window.__mobileApp;
                    app.closeSettings();
                    app.setState({ panX: 14, panY: -11, selectedRoot: null, autoRotate: false });
                    app.forceRender();
                    app.hideStatus();
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: 88,
                        pointerType: 'touch',
                        clientX: x,
                        clientY: y,
                        isPrimary: true,
                    }));
                    const beforeState = app.getState();
                    const beforeMetrics = app.getMetrics();
                    fire('pointerdown', 195, 420);
                    fire('pointermove', 197, 422);
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    const duringState = app.getState();
                    const duringMetrics = app.getMetrics();
                    fire('pointerup', 197, 422);
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    const afterState = app.getState();
                    const afterMetrics = app.getMetrics();
                    app.clearSelection();
                    app.setState({ panX: 0, panY: 0, selectedRoot: null });
                    app.forceRender();
                    app.hideStatus();
                    return { beforeState, beforeMetrics, duringState, duringMetrics, afterState, afterMetrics };
                }"""
            )
            check("tap jitter does not pan while pointer is down", jitter_probe["duringState"]["panX"] == jitter_probe["beforeState"]["panX"] and jitter_probe["duringState"]["panY"] == jitter_probe["beforeState"]["panY"] and jitter_probe["duringMetrics"]["renderCount"] == jitter_probe["beforeMetrics"]["renderCount"], str(jitter_probe))
            check("tap jitter records ignored movement", jitter_probe["duringMetrics"]["tapJitterIgnoredCount"] > jitter_probe["beforeMetrics"]["tapJitterIgnoredCount"] and jitter_probe["duringMetrics"]["lastTapJitterDistance"] <= 3, str(jitter_probe["duringMetrics"]))
            check("tap jitter still resolves as tap selection", jitter_probe["afterState"]["selectedRoot"] is not None and jitter_probe["afterState"]["panX"] == jitter_probe["beforeState"]["panX"] and jitter_probe["afterState"]["panY"] == jitter_probe["beforeState"]["panY"], str(jitter_probe))

            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.mouse.click(195, 420)
            page.evaluate("() => window.__mobileApp.forceRender()")
            selected = page.evaluate("() => window.__mobileApp.getState().selectedRoot")
            check("tap selects a root", selected is not None, str(selected))
            tap_status = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("tap selection shows root status", tap_status["statusVisible"] and tap_status["statusText"] == f"Root #{selected}", str(tap_status))
            context_info = page.evaluate("() => window.__mobileApp.getMetrics().selectedContext")
            check("selected root exposes neighbor context", bool(context_info), str(context_info))
            check("selected root has 56 Cartan edge neighbors", context_info["neighborCount"] == 56 and context_info["neighborDot"] == -1, str(context_info))
            check("selected root exposes 8D coordinates", len(context_info["coordinates"]) == 8 and abs(context_info["norm"] - 2) < 0.001, str(context_info))
            check("selected root exposes opposite root", context_info["antipode"] is not None, str(context_info))
            drawer_text = page.locator("#root-drawer").inner_text()
            drawer_box = page.locator("#root-drawer").bounding_box()
            drawer_actions = page.locator("#root-drawer [data-root-action]").count()
            collapsed_drawer_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("collapsed root drawer shows neighbor count", "Neighbors 56" in drawer_text and "8D [" not in drawer_text and drawer_actions == 0 and not collapsed_drawer_metrics["rootDrawerExpanded"], drawer_text)
            check("collapsed root drawer keeps tiny canvas footprint", bool(drawer_box) and drawer_box["height"] <= 82 and collapsed_drawer_metrics["rootDrawerHeight"] <= 82, str({"box": drawer_box, "metrics": collapsed_drawer_metrics}))
            drawer_style = page.evaluate(
                """() => {
                    const style = getComputedStyle(document.getElementById('root-drawer'));
                    return {
                        backdropFilter: style.backdropFilter || '',
                        webkitBackdropFilter: style.webkitBackdropFilter || '',
                        backgroundColor: style.backgroundColor
                    };
                }"""
            )
            check("root drawer avoids backdrop blur", drawer_style["backdropFilter"] in ["", "none"] and drawer_style["webkitBackdropFilter"] in ["", "none"], str(drawer_style))
            page.get_by_role("button", name="Expand selected root controls").click()
            expanded_drawer = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                actionCount: document.querySelectorAll('#root-drawer [data-root-action]').length,
                text: document.getElementById('root-drawer').innerText,
                toggleExpanded: document.querySelector('[data-root-drawer-toggle]')?.getAttribute('aria-expanded')
            })""")
            expanded_box = page.locator("#root-drawer").bounding_box()
            check("expanded root drawer exposes root actions", expanded_drawer["metrics"]["rootDrawerExpanded"] and expanded_drawer["actionCount"] == 4 and expanded_drawer["toggleExpanded"] == "true" and expanded_drawer["metrics"]["rootDrawerExpandCount"] >= 1, str(expanded_drawer))
            check("expanded root drawer stays compact", bool(expanded_box) and expanded_box["height"] <= 126, str(expanded_box))
            check("debug back collapses expanded root drawer first", page.evaluate("() => window.__mobileApp.handleBackNavigation()"))
            collapsed_by_back = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("back collapse keeps selected root", not collapsed_by_back["rootDrawerExpanded"] and collapsed_by_back["rootDrawerCollapseCount"] >= 1 and collapsed_by_back["lastRootDrawerToggleReason"] == "back-collapse-drawer" and page.evaluate("() => window.__mobileApp.getState().selectedRoot") == selected, str(collapsed_by_back))
            selection_dom_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.evaluate("() => window.__mobileApp.openSettings('info')")
            selection_dom_after = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("same selected root skips duplicate detail DOM", selection_dom_after["selectionUiFullDomSkipCount"] > selection_dom_before["selectionUiFullDomSkipCount"] and selection_dom_after["selectionUiFullDomWriteCount"] == selection_dom_before["selectionUiFullDomWriteCount"] and selection_dom_after["lastSelectionUiDomRoot"] == selected, str(selection_dom_after))
            info_detail_text = page.locator("#info-selection").inner_text()
            check("Info section keeps full selected root detail", f"Root #{selected}" in info_detail_text and "8D [" in info_detail_text and "Norm: 2" in info_detail_text, info_detail_text)
            auto_pan_probe = page.evaluate(
                """() => {
                    window.__mobileApp.closeSettings();
                    window.__mobileApp.clearSelection();
                    window.__mobileApp.setState({ zoom: 1, panX: 0, panY: 0, rotation: 0, autoRotate: false, selectedRoot: null });
                    window.__mobileApp.forceRender();
                    const base = window.__mobileApp.getRootScreenPoint(0);
                    window.__mobileApp.setState({ panY: window.innerHeight - 24 - base.y, selectedRoot: null });
                    window.__mobileApp.forceRender();
                    const before = window.__mobileApp.getRootScreenPoint(0);
                    const beforeCount = window.__mobileApp.getMetrics().selectionAutoPanCount;
                    window.__mobileApp.selectRoot(0);
                    window.__mobileApp.forceRender();
                    return {
                        before,
                        beforeCount,
                        after: window.__mobileApp.getRootScreenPoint(0),
                        metrics: window.__mobileApp.getMetrics(),
                    };
                }"""
            )
            frame = auto_pan_probe["metrics"]["selectedRootFrame"]
            check("selected root starts below drawer-aware view", auto_pan_probe["before"]["y"] > frame["view"]["bottom"], str(auto_pan_probe))
            check("selected root auto-pans above drawer", frame["withinView"] and auto_pan_probe["after"]["y"] <= frame["view"]["bottom"] - frame["pad"], str(auto_pan_probe))
            check("selected root auto-pan records telemetry", auto_pan_probe["metrics"]["selectionAutoPanCount"] > auto_pan_probe["beforeCount"] and auto_pan_probe["metrics"]["lastSelectionAutoPanDy"] < 0, str(auto_pan_probe["metrics"]))

            page.evaluate("() => { window.__mobileApp.selectRoot(0); window.__mobileApp.forceRender(); }")
            page.get_by_role("button", name="Expand selected root controls").click()
            before_focus = page.evaluate("() => ({...window.__mobileApp.getState()})")
            page.get_by_role("button", name="Focus").click()
            page.evaluate("() => window.__mobileApp.forceRender()")
            after_focus = page.evaluate("() => window.__mobileApp.getState()")
            moved = abs(after_focus["panX"] - before_focus["panX"]) > 0.1 or abs(after_focus["panY"] - before_focus["panY"]) > 0.1
            check("focus action centers selected root", after_focus["selectedRoot"] == 0 and moved, f"{before_focus} -> {after_focus}")
            point_tap = page.evaluate(
                """() => {
                    window.__mobileApp.forceRender();
                    return window.__mobileApp.getRootScreenPoint(window.__mobileApp.getState().selectedRoot);
                }"""
            )
            check("debug API reports selected point screen position", bool(point_tap), str(point_tap))
            page.evaluate(
                """point => {
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = type => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: 11,
                        pointerType: 'touch',
                        clientX: point.x,
                        clientY: point.y,
                        isPrimary: true,
                    }));
                    fire('pointerdown');
                    fire('pointerup');
                }""",
                point_tap,
            )
            check("tapping selected root clears selection", page.evaluate("() => window.__mobileApp.getState().selectedRoot") is None)
            page.evaluate("() => { window.__mobileApp.selectRoot(0); window.__mobileApp.forceRender(); }")
            page.get_by_role("button", name="Expand selected root controls").click()

            root_zero_context = page.evaluate("() => window.__mobileApp.getMetrics().selectedContext")
            page.get_by_role("button", name="Opposite").click()
            check("opposite action selects antipode", page.evaluate("() => window.__mobileApp.getState().selectedRoot") == root_zero_context["antipode"])

            opposite = page.evaluate("() => window.__mobileApp.getState().selectedRoot")
            page.get_by_role("button", name="Neighbor").click()
            neighbor = page.evaluate("() => window.__mobileApp.getState().selectedRoot")
            check("neighbor action advances selection", neighbor is not None and neighbor != opposite, f"{opposite} -> {neighbor}")

            page.get_by_role("button", name="Clear").click()
            clear_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("clear action clears selection", page.evaluate("() => window.__mobileApp.getState().selectedRoot") is None)
            check("clear action shows status", clear_metrics["statusVisible"] and clear_metrics["statusText"] == "Selection cleared", str(clear_metrics))
            page.evaluate("() => window.__mobileApp.hideStatus()")

            page.evaluate("() => window.__mobileApp.selectRoot(197)")
            check("debug API can select a root", page.evaluate("() => window.__mobileApp.getState().selectedRoot") == 197)
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = type => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: 9,
                        pointerType: 'touch',
                        clientX: 4,
                        clientY: 4,
                        isPrimary: true,
                    }));
                    fire('pointerdown');
                    fire('pointerup');
                }"""
            )
            check("empty tap clears selection", page.evaluate("() => window.__mobileApp.getState().selectedRoot") is None)

            motion_before = page.evaluate("() => window.__mobileApp.getMetrics()")
            page.evaluate("() => { window.__mobileApp.closeSettings(); window.__mobileApp.setState({ autoRotate: true }); }")
            page.wait_for_function(
                """before => {
                    const metrics = window.__mobileApp.getMetrics();
                    return metrics.motionActive &&
                        metrics.motionFrameRenderCount > before.rendered &&
                        metrics.motionFrameSkipCount > before.skipped;
                }""",
                arg={"rendered": motion_before["motionFrameRenderCount"], "skipped": motion_before["motionFrameSkipCount"]},
                timeout=1500,
            )
            paced_motion = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("auto-rotate starts when settings closed", paced_motion["motionActive"], str(paced_motion))
            check("auto-rotate is frame paced", paced_motion["motionFrameTargetMs"] >= 30 and paced_motion["motionFrameRenderCount"] > motion_before["motionFrameRenderCount"] and paced_motion["motionFrameSkipCount"] > motion_before["motionFrameSkipCount"] and paced_motion["lastMotionFrameDeltaMs"] >= paced_motion["motionFrameTargetMs"], str(paced_motion))
            page.evaluate("() => window.__mobileApp.openSettings('motion')")
            check("settings pauses auto-rotate loop", not page.evaluate("() => window.__mobileApp.getMetrics().motionActive"))
            page.evaluate("() => window.__mobileApp.closeSettings()")
            page.wait_for_timeout(80)
            check("closing settings resumes auto-rotate", page.evaluate("() => window.__mobileApp.getMetrics().motionActive"))
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    canvas.dispatchEvent(new PointerEvent('pointerdown', {
                        bubbles: true,
                        pointerId: 31,
                        pointerType: 'touch',
                        clientX: 180,
                        clientY: 440,
                        isPrimary: true,
                    }));
                }"""
            )
            page.wait_for_function("() => Number(getComputedStyle(document.getElementById('settings-button')).opacity) < 0.5")
            active_touch_motion = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                shellFaded: document.querySelector('.mobile-shell').classList.contains('is-interacting'),
                settingsOpacity: Number(getComputedStyle(document.getElementById('settings-button')).opacity)
            })""")
            check("active touch pauses auto-rotate", active_touch_motion["metrics"]["interactionActive"] and active_touch_motion["metrics"]["motionPausedForInteraction"] and not active_touch_motion["metrics"]["motionActive"], str(active_touch_motion))
            check("active touch fades persistent chrome", active_touch_motion["metrics"]["chromeFaded"] and active_touch_motion["shellFaded"] and active_touch_motion["settingsOpacity"] < 0.5, str(active_touch_motion))
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    canvas.dispatchEvent(new PointerEvent('pointerup', {
                        bubbles: true,
                        pointerId: 31,
                        pointerType: 'touch',
                        clientX: 180,
                        clientY: 440,
                        isPrimary: true,
                    }));
                }"""
            )
            page.wait_for_timeout(80)
            page.wait_for_function("() => Number(getComputedStyle(document.getElementById('settings-button')).opacity) > 0.9")
            released_touch_motion = page.evaluate("""() => ({
                metrics: window.__mobileApp.getMetrics(),
                shellFaded: document.querySelector('.mobile-shell').classList.contains('is-interacting'),
                settingsOpacity: Number(getComputedStyle(document.getElementById('settings-button')).opacity)
            })""")
            check("auto-rotate resumes after touch release", not released_touch_motion["metrics"]["interactionActive"] and released_touch_motion["metrics"]["motionActive"], str(released_touch_motion))
            check("touch release restores persistent chrome", not released_touch_motion["metrics"]["chromeFaded"] and not released_touch_motion["shellFaded"] and released_touch_motion["settingsOpacity"] > 0.9, str(released_touch_motion))
            page.evaluate("() => window.__mobileApp.setState({ autoRotate: false })")
            check("auto-rotate stops cleanly", not page.evaluate("() => window.__mobileApp.getMetrics().motionActive"))

            page.evaluate("() => window.__mobileApp.setState({ showRings: true, autoRotate: false })")
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: 41,
                        pointerType: 'touch',
                        clientX: x,
                        clientY: y,
                        isPrimary: true,
                    }));
                    fire('pointerdown', 180, 450);
                    fire('pointermove', 212, 472);
                    window.__mobileApp.forceRender();
                }"""
            )
            active_drag_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("active drag uses interaction-lite render", active_drag_metrics["interactionActive"] and active_drag_metrics["lastDrawStats"]["interactionLiteFrame"], str(active_drag_metrics))
            check("active drag skips decorative rings", active_drag_metrics["lastDrawStats"]["rings"] == 0 and active_drag_metrics["lastDrawStats"]["ringStrokes"] == 0 and active_drag_metrics["lastDrawStats"]["ringsSkippedForInteraction"] == 8, str(active_drag_metrics["lastDrawStats"]))
            check("active drag skips glow halos", active_drag_metrics["lastDrawStats"]["directPointFills"] == active_drag_metrics["lastDrawStats"]["directPoints"] and active_drag_metrics["lastDrawStats"]["glowFills"] == 0 and active_drag_metrics["lastDrawStats"]["glowsSkippedForInteraction"] == active_drag_metrics["lastDrawStats"]["directPoints"], str(active_drag_metrics["lastDrawStats"]))
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    canvas.dispatchEvent(new PointerEvent('pointerup', {
                        bubbles: true,
                        pointerId: 41,
                        pointerType: 'touch',
                        clientX: 212,
                        clientY: 472,
                        isPrimary: true,
                    }));
                }"""
            )
            page.wait_for_function("count => window.__mobileApp.getMetrics().renderCount > count", arg=active_drag_metrics["renderCount"])
            settled_drag_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("settled drag restores rings", not settled_drag_metrics["interactionActive"] and not settled_drag_metrics["lastDrawStats"]["interactionLiteFrame"] and settled_drag_metrics["lastDrawStats"]["rings"] == 8 and settled_drag_metrics["lastDrawStats"]["ringsSkippedForInteraction"] == 0, str(settled_drag_metrics))
            check("settled drag restores glow halos", settled_drag_metrics["lastDrawStats"]["glowFills"] == settled_drag_metrics["lastDrawStats"]["directPoints"] and settled_drag_metrics["lastDrawStats"]["glowsSkippedForInteraction"] == 0 and settled_drag_metrics["lastDrawStats"]["directPointFills"] == settled_drag_metrics["lastDrawStats"]["directPoints"] * 2, str(settled_drag_metrics["lastDrawStats"]))
            check("pan release requests settled render", settled_drag_metrics["settledRenderRequestCount"] > active_drag_metrics["settledRenderRequestCount"] and settled_drag_metrics["lastSettledRenderRequestReason"] == "pan-end", str(settled_drag_metrics))

            page.evaluate("() => { window.__mobileApp.setState({ showRings: true, showContext: true, autoRotate: false, subset: 'icosahedron', selectedRoot: null }); window.__mobileApp.selectRoot(0, { save: false, status: false }); window.__mobileApp.forceRender(); }")
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: 42,
                        pointerType: 'touch',
                        clientX: x,
                        clientY: y,
                        isPrimary: true,
                    }));
                    fire('pointerdown', 182, 452);
                    fire('pointermove', 214, 474);
                    window.__mobileApp.forceRender();
                }"""
            )
            active_context_drag = page.evaluate("() => window.__mobileApp.getMetrics()")
            active_context_draw = active_context_drag["lastDrawStats"]
            check("active context drag skips rays", active_context_drag["interactionActive"] and active_context_draw["interactionLiteFrame"] and active_context_draw["rays"] == 0 and active_context_draw["rayStrokes"] == 0 and active_context_draw["raysSkippedForInteraction"] == 56, str(active_context_drag))
            check("active context drag keeps context points", active_context_draw["neighborPoints"] == 56 and active_context_draw["selectedPoints"] == 1 and active_context_draw["directPoints"] == 64, str(active_context_draw))
            check("active context drag skips glow halos", active_context_draw["directPointFills"] == active_context_draw["directPoints"] and active_context_draw["glowFills"] == 0 and active_context_draw["glowsSkippedForInteraction"] == active_context_draw["directPoints"], str(active_context_draw))
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    canvas.dispatchEvent(new PointerEvent('pointerup', {
                        bubbles: true,
                        pointerId: 42,
                        pointerType: 'touch',
                        clientX: 214,
                        clientY: 474,
                        isPrimary: true,
                    }));
                }"""
            )
            page.wait_for_function("count => window.__mobileApp.getMetrics().renderCount > count", arg=active_context_drag["renderCount"])
            settled_context_drag = page.evaluate("() => window.__mobileApp.getMetrics()")
            settled_context_draw = settled_context_drag["lastDrawStats"]
            check("settled context drag restores rays", not settled_context_drag["interactionActive"] and not settled_context_draw["interactionLiteFrame"] and settled_context_draw["rays"] == 56 and settled_context_draw["rayStrokes"] == 1 and settled_context_draw["raysSkippedForInteraction"] == 0, str(settled_context_drag))
            check("settled context drag restores glow halos", settled_context_draw["glowFills"] == settled_context_draw["directPoints"] and settled_context_draw["glowsSkippedForInteraction"] == 0 and settled_context_draw["directPointFills"] == settled_context_draw["directPoints"] * 2, str(settled_context_draw))
            check("context pan release requests settled render", settled_context_drag["settledRenderRequestCount"] > active_context_drag["settledRenderRequestCount"] and settled_context_drag["lastSettledRenderRequestReason"] == "pan-end", str(settled_context_drag))
            page.evaluate("() => window.__mobileApp.clearSelection()")

            before_pan = page.evaluate("() => window.__mobileApp.getState()")
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: 7,
                        pointerType: 'touch',
                        clientX: x,
                        clientY: y,
                        isPrimary: true,
                    }));
                    fire('pointerdown', 180, 450);
                    fire('pointermove', 218, 476);
                    fire('pointerup', 218, 476);
                }"""
            )
            after_pan = page.evaluate("() => window.__mobileApp.getState()")
            pan_moved = abs(after_pan["panX"] - before_pan["panX"]) > 20 or abs(after_pan["panY"] - before_pan["panY"]) > 20
            check("one-finger drag keeps panning the flat E8 canvas", pan_moved, f"{before_pan} -> {after_pan}")
            drag_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            check("drag releases input state", not drag_metrics["interactionActive"] and drag_metrics["pointerCount"] == 0, str(drag_metrics))

            platonic_orbit = page.evaluate(
                """async () => {
                    const app = window.__mobileApp;
                    app.setState({
                        modelMode: 'platonic',
                        shape: 'dodecahedron',
                        rotation: 0,
                        cameraTilt: 0.28,
                        cameraPath: 'orbit',
                        autoRotate: true,
                        panX: 11,
                        panY: -9,
                        selectedRoot: null
                    });
                    app.forceRender();
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: 71,
                        pointerType: 'touch',
                        clientX: x,
                        clientY: y,
                        isPrimary: true,
                    }));
                    const before = app.getState();
                    fire('pointerdown', 160, 440);
                    fire('pointermove', 202, 470);
                    const during = app.getState();
                    fire('pointerup', 202, 470);
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    return { before, during, after: app.getState(), metrics: app.getMetrics() };
                }"""
            )
            check("one-finger drag orbits Platonic solids instead of panning", abs(platonic_orbit["during"]["rotation"] - platonic_orbit["before"]["rotation"]) > 0.2 and abs(platonic_orbit["during"]["cameraTilt"] - platonic_orbit["before"]["cameraTilt"]) > 0.1 and platonic_orbit["during"]["panX"] == platonic_orbit["before"]["panX"] and platonic_orbit["during"]["panY"] == platonic_orbit["before"]["panY"] and not platonic_orbit["during"]["autoRotate"] and platonic_orbit["during"]["cameraPath"] == "manual", str(platonic_orbit))
            check("Platonic orbit drag settles to the solid renderer", platonic_orbit["metrics"]["lastInteractionType"] == "orbit-end" and platonic_orbit["metrics"]["lastSettledRenderRequestReason"] == "orbit-end" and not platonic_orbit["metrics"]["interactionActive"] and platonic_orbit["metrics"]["pointerCount"] == 0 and platonic_orbit["metrics"]["lastDrawStats"]["modelFaces"] == 12 and platonic_orbit["metrics"]["lastDrawStats"]["modelFaceFills"] == 12, str(platonic_orbit["metrics"]))

            polytope_orbit = page.evaluate(
                """async () => {
                    const app = window.__mobileApp;
                    app.setState({ modelMode: 'poly4d', polytope4d: '24cell', rotation: 0, cameraTilt: 0.28, cameraPath: 'manual', autoRotate: false, panX: 0, panY: 0 });
                    app.forceRender();
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: 72,
                        pointerType: 'touch',
                        clientX: x,
                        clientY: y,
                        isPrimary: true,
                    }));
                    const before = app.getState();
                    fire('pointerdown', 210, 470);
                    fire('pointermove', 178, 444);
                    fire('pointerup', 178, 444);
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    return { before, after: app.getState(), metrics: app.getMetrics() };
                }"""
            )
            check("one-finger drag also orbits 4D model projections", abs(polytope_orbit["after"]["rotation"] - polytope_orbit["before"]["rotation"]) > 0.2 and abs(polytope_orbit["after"]["cameraTilt"] - polytope_orbit["before"]["cameraTilt"]) > 0.1 and polytope_orbit["after"]["panX"] == polytope_orbit["before"]["panX"] and polytope_orbit["after"]["panY"] == polytope_orbit["before"]["panY"] and polytope_orbit["metrics"]["lastInteractionType"] == "orbit-end" and polytope_orbit["metrics"]["lastDrawStats"]["modelMode"] == "poly4d", str(polytope_orbit))

            pointer_cancel_probe = page.evaluate(
                """async () => {
                    const app = window.__mobileApp;
                    app.setState({ modelMode: 'e8_2d', selectedRoot: null, autoRotate: false, zoom: 1, panX: 0, panY: 0, rotation: 0 });
                    app.forceRender();
                    const point = app.getRootScreenPoint(0);
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = type => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: 81,
                        pointerType: 'touch',
                        clientX: point.x,
                        clientY: point.y,
                        isPrimary: true,
                    }));
                    fire('pointerdown');
                    fire('pointercancel');
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    return { state: app.getState(), metrics: app.getMetrics() };
                }"""
            )
            check("pointer cancellation never selects a root", pointer_cancel_probe["state"]["selectedRoot"] is None, str(pointer_cancel_probe))
            check("pointer cancellation releases input and requests a settled frame", not pointer_cancel_probe["metrics"]["interactionActive"] and pointer_cancel_probe["metrics"]["pointerCount"] == 0 and pointer_cancel_probe["metrics"]["lastInteractionType"] == "pointer-cancel" and pointer_cancel_probe["metrics"]["lastSettledRenderRequestReason"] == "pointer-cancel", str(pointer_cancel_probe["metrics"]))

            pinch_jitter_probe = page.evaluate(
                """async () => {
                    const app = window.__mobileApp;
                    app.setState({ modelMode: 'e8_2d', e8MorphT: 0, showRings: true, showContext: true, autoRotate: false, selectedRoot: null, zoom: 1, panX: 8, panY: -6, rotation: 0 });
                    app.forceRender();
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: id,
                        pointerType: 'touch',
                        clientX: x,
                        clientY: y,
                        isPrimary: id === 1,
                    }));
                    const beforeState = app.getState();
                    const beforeMetrics = app.getMetrics();
                    fire('pointerdown', 1, 150, 460);
                    fire('pointerdown', 2, 240, 460);
                    fire('pointermove', 1, 151, 461);
                    fire('pointermove', 2, 239, 459);
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    const duringState = app.getState();
                    const duringMetrics = app.getMetrics();
                    fire('pointerup', 1, 151, 461);
                    fire('pointerup', 2, 239, 459);
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    const afterState = app.getState();
                    const afterMetrics = app.getMetrics();
                    return { beforeState, beforeMetrics, duringState, duringMetrics, afterState, afterMetrics };
                }"""
            )
            check("pinch jitter does not zoom or pan while held", pinch_jitter_probe["duringState"]["zoom"] == pinch_jitter_probe["beforeState"]["zoom"] and pinch_jitter_probe["duringState"]["panX"] == pinch_jitter_probe["beforeState"]["panX"] and pinch_jitter_probe["duringState"]["panY"] == pinch_jitter_probe["beforeState"]["panY"] and pinch_jitter_probe["duringMetrics"]["renderCount"] == pinch_jitter_probe["beforeMetrics"]["renderCount"], str(pinch_jitter_probe))
            check("pinch jitter records ignored movement", pinch_jitter_probe["duringMetrics"]["pinchJitterIgnoredCount"] > pinch_jitter_probe["beforeMetrics"]["pinchJitterIgnoredCount"] and pinch_jitter_probe["duringMetrics"]["lastPinchJitterDistanceDelta"] <= 3 and pinch_jitter_probe["duringMetrics"]["lastPinchJitterCenterDelta"] <= 3, str(pinch_jitter_probe["duringMetrics"]))
            check("pinch jitter releases input state", not pinch_jitter_probe["afterMetrics"]["interactionActive"] and pinch_jitter_probe["afterMetrics"]["pointerCount"] == 0, str(pinch_jitter_probe["afterMetrics"]))

            focal_pinch_probe = page.evaluate(
                """async () => {
                    const app = window.__mobileApp;
                    app.setState({ modelMode: 'e8_2d', autoRotate: false, selectedRoot: null, zoom: 1, panX: 0, panY: 0, rotation: 0 });
                    app.forceRender();
                    const before = app.getRootScreenPoint(0);
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: id,
                        pointerType: 'touch',
                        clientX: x,
                        clientY: y,
                        isPrimary: id === 91,
                    }));
                    fire('pointerdown', 91, before.x - 34, before.y);
                    fire('pointerdown', 92, before.x + 34, before.y);
                    fire('pointermove', 91, before.x - 68, before.y);
                    fire('pointermove', 92, before.x + 68, before.y);
                    app.forceRender();
                    const during = app.getRootScreenPoint(0);
                    fire('pointerup', 91, before.x - 68, before.y);
                    fire('pointerup', 92, before.x + 68, before.y);
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    return {
                        before,
                        during,
                        drift: Math.hypot(during.x - before.x, during.y - before.y),
                        state: app.getState(),
                        metrics: app.getMetrics()
                    };
                }"""
            )
            check("off-center pinch stays anchored under the fingers", focal_pinch_probe["state"]["zoom"] > 1.5 and focal_pinch_probe["drift"] < 1.5, str(focal_pinch_probe))
            check("focal pinch releases input cleanly", not focal_pinch_probe["metrics"]["interactionActive"] and focal_pinch_probe["metrics"]["pointerCount"] == 0 and focal_pinch_probe["metrics"]["lastInteractionType"] == "pinch-end", str(focal_pinch_probe["metrics"]))

            page.evaluate("() => { window.__mobileApp.setState({ showRings: true, showContext: true, autoRotate: false, subset: 'icosahedron', selectedRoot: null, zoom: 1, panX: 0, panY: 0, rotation: 0 }); window.__mobileApp.selectRoot(0, { save: false, status: false }); window.__mobileApp.forceRender(); }")
            before_zoom = page.evaluate("() => window.__mobileApp.getState().zoom")
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: id,
                        pointerType: 'touch',
                        clientX: x,
                        clientY: y,
                        isPrimary: id === 1,
                    }));
                    fire('pointerdown', 1, 150, 460);
                    fire('pointerdown', 2, 240, 460);
                    fire('pointermove', 1, 120, 460);
                    fire('pointermove', 2, 270, 460);
                    window.__mobileApp.forceRender();
                }"""
            )
            active_pinch_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            active_pinch_draw = active_pinch_metrics["lastDrawStats"]
            check("active pinch uses interaction-lite render", active_pinch_metrics["interactionActive"] and active_pinch_metrics["pointerCount"] == 2 and active_pinch_draw["interactionLiteFrame"], str(active_pinch_metrics))
            check("active pinch skips rings rays and glows", active_pinch_draw["ringsSkippedForInteraction"] == 8 and active_pinch_draw["raysSkippedForInteraction"] == 56 and active_pinch_draw["glowsSkippedForInteraction"] == active_pinch_draw["directPoints"], str(active_pinch_draw))
            page.evaluate(
                """() => {
                    const canvas = document.getElementById('mobile-canvas');
                    const fire = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, {
                        bubbles: true,
                        pointerId: id,
                        pointerType: 'touch',
                        clientX: x,
                        clientY: y,
                        isPrimary: id === 1,
                    }));
                    fire('pointerup', 1, 120, 460);
                    fire('pointerup', 2, 270, 460);
                }"""
            )
            page.wait_for_function("count => window.__mobileApp.getMetrics().renderCount > count", arg=active_pinch_metrics["renderCount"])
            after_zoom = page.evaluate("() => window.__mobileApp.getState().zoom")
            check("pinch gesture changes zoom", after_zoom > before_zoom + 0.1, f"{before_zoom} -> {after_zoom}")
            pinch_metrics = page.evaluate("() => window.__mobileApp.getMetrics()")
            pinch_draw = pinch_metrics["lastDrawStats"]
            check("pinch releases input state", not pinch_metrics["interactionActive"] and pinch_metrics["pointerCount"] == 0, str(pinch_metrics))
            check("pinch telemetry records pinch end", pinch_metrics["lastInteractionType"] == "pinch-end", str(pinch_metrics))
            check("pinch release requests settled render", pinch_metrics["settledRenderRequestCount"] > active_pinch_metrics["settledRenderRequestCount"] and pinch_metrics["lastSettledRenderRequestReason"] == "pinch-end", str(pinch_metrics))
            check("settled pinch restores full context visuals", not pinch_draw["interactionLiteFrame"] and pinch_draw["rings"] == 8 and pinch_draw["rays"] == 56 and pinch_draw["glowFills"] == pinch_draw["directPoints"] and pinch_draw["glowsSkippedForInteraction"] == 0, str(pinch_draw))
            page.evaluate("() => window.__mobileApp.openSettings('view')")
            check("zoom output syncs after pinch", page.locator("#zoom-output").inner_text() == f"{round(after_zoom * 100)}%")
            page.evaluate("() => window.__mobileApp.closeSettings()")

            runtime_errors = page.evaluate("() => window.__mobileApp.getMetrics().runtimeErrors")
            check("no mobile runtime errors", len(runtime_errors) == 0, str(runtime_errors))
            check("no console errors", len(console_errs) == 0, str(console_errs[:3]))
            browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()

    print("\nMobile V2 smoke passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
