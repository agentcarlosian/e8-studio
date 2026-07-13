#!/usr/bin/env python3
"""Focused regression test for camera zoom and cross-view motion isolation."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from verify import find_chromium_executable, start_server  # noqa: E402


def main() -> int:
    from playwright.sync_api import sync_playwright

    httpd, base = start_server()
    try:
        with sync_playwright() as p:
            launch = {"headless": True, "args": ["--no-sandbox", "--use-gl=angle",
                      "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]}
            executable = find_chromium_executable()
            if executable:
                launch["executable_path"] = executable
            browser = p.chromium.launch(**launch)
            page = browser.new_page(viewport={"width": 1100, "height": 820})
            errors: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.goto(f"{base}/dist/index.html", wait_until="commit", timeout=20000)
            try:
                page.wait_for_function("() => !!window.__app?.currentView", timeout=40000)
            except Exception:
                print("startup errors:", errors)
                raise
            page.evaluate("() => document.getElementById('welcome-card')?.classList.add('hidden')")

            view_switch = page.evaluate("""() => [...document.querySelectorAll('.ps-view-switch [data-act="switchView"]')]
              .map(button => ({ view: button.dataset.arg, label: button.textContent.trim() }))""")
            assert view_switch == [
                {"view": "bloom", "label": "bloom"},
                {"view": "platonic", "label": "platonic"},
                {"view": "e8coxeter", "label": "E₈"},
                {"view": "sixhundred", "label": "600"},
                {"view": "polytope", "label": "4D"},
                {"view": "raymarched", "label": "SDF"},
            ], view_switch
            print("ok compact View selector exposes all six core views")

            zoom = page.evaluate("""() => {
              window.__app.switchView('platonic');
              window.__app.setParam('autoSliders', ['cameraDistance']);
              const el = document.querySelector('input[data-param="cameraDistance"]');
              // Inverted UI: raw 11.2 maps to physical distance 3.2.
              el.value = '11.2';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              return {
                param: window.__app.params.cameraDistance,
                actual: window.__app.camera.position.length(),
                autoStopped: !window.__app.params.autoSliders.includes('cameraDistance'),
                path: window.__app.params.cameraPath,
                orbit: window.__app.params.cameraOrbit,
              };
            }""")
            assert abs(zoom["param"] - 3.2) < 0.05, zoom
            assert abs(zoom["actual"] - 3.2) < 0.05, zoom
            assert zoom["autoStopped"] and zoom["path"] == "manual" and not zoom["orbit"], zoom
            print("ok zoom slider moves the physical camera")

            rotation = page.evaluate("""() => {
              const el = document.querySelector('input[data-param="cameraRotation"]');
              el.value = '1.2';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              const p = window.__app.camera.position;
              return { value: window.__app.params.cameraRotation, azimuth: Math.atan2(p.x, p.z) };
            }""")
            assert abs(rotation["value"] - 1.2) < 0.02, rotation
            assert abs(rotation["azimuth"] - 1.2) < 0.02, rotation
            print("ok rotation slider directly changes camera angle")

            page.evaluate("""() => {
              window.__app.setParam('cameraDistance', 3.1);
              window.__app.setParam('cameraRotation', -2.2);
              window.__app.setParam('cameraOrbit', true);
              window.__app.setParam('autoZoom', true);
              window.__app.setParam('cameraPath', 'petrieSpiral');
              window.__app.setParam('autoSliders', ['cameraDistance', 'cameraRotation', 'e8MorphT']);
            }""")
            reset_button = page.locator('[data-act="resetCamera"]')
            assert reset_button.count() == 1
            reset_button.click()
            page.wait_for_timeout(350)
            reset = page.evaluate("""() => ({
              distance: window.__app.params.cameraDistance,
              rotation: window.__app.params.cameraRotation,
              actualDistance: window.__app.camera.position.length(),
              actualRotation: Math.atan2(window.__app.camera.position.x, window.__app.camera.position.z),
              orbit: window.__app.params.cameraOrbit,
              zoom: window.__app.params.autoZoom,
              path: window.__app.params.cameraPath,
              speed: window.__app.params.cameraSpeed,
              autos: window.__app.params.autoSliders.slice(),
            })""")
            assert abs(reset["distance"] - 6) < 0.05, reset
            assert abs(reset["actualDistance"] - 6) < 0.08, reset
            assert abs(reset["rotation"] - 3.141592653589793 / 6) < 0.02, reset
            assert abs(reset["actualRotation"] - 3.141592653589793 / 6) < 0.02, reset
            assert not reset["orbit"] and not reset["zoom"] and reset["path"] == "manual", reset
            assert reset["speed"] == 1 and reset["autos"] == ["e8MorphT"], reset
            print("ok Reset button cancels camera drivers and holds the canonical pose")

            transition = page.evaluate("""() => {
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
            assert transition["cleared"] == {
                "poly": False, "rotate": False, "orbit": False,
                "path": "manual", "zoom": False, "autos": [],
            }, transition
            assert transition["sdfAutos"] == ["e8MorphT"], transition
            assert not errors, errors
            print("ok core view switches isolate motion and preserve E8-to-SDF flux")

            extrude = page.evaluate("""() => {
              const views = ['bloom', 'platonic', 'e8coxeter', 'sixhundred', 'polytope'];
              const visible = {};
              for (const view of views) {
                window.__app.switchView(view);
                visible[view] = !!document.querySelector('input[data-param="e8MorphT"]');
              }
              window.__app.switchView('platonic');
              window.__app.setParam('e8MorphT', 1);
              window.__app.currentView.update(0.016, 1, window.__app.params);
              const platonicDepthScale = window.__app.currentView.object3d.scale.z;
              window.__app.switchView('sixhundred');
              window.__app.setParam('e8MorphT', 0);
              window.__app.currentView.update(0.016, 1, window.__app.params);
              const attr = window.__app.currentView.object3d.userData.edgeLines.geometry.attributes.position;
              const before = Array.from(attr.array);
              window.__app.setParam('e8MorphT', 1);
              window.__app.currentView.update(0.016, 1, window.__app.params);
              const after = Array.from(attr.array);
              return {
                visible,
                platonicDepthScale,
                sixHundredMoved: before.some((value, i) => Math.abs(value - after[i]) > 1e-4),
              };
            }""")
            assert all(extrude["visible"].values()), extrude
            assert extrude["platonicDepthScale"] > 1.5, extrude
            assert extrude["sixHundredMoved"], extrude
            print("ok Extrude is visible and active across every core view")

            page.evaluate("""() => {
              window.__app.applyGalleryPreset('electric-tesseract');
              window.__app.applyGalleryPreset('plasma-storm');
              window.__app.setParam('morph4d', 1.8);
              window.__app.applyGalleryPreset('coxeter-rings');
            }""")
            baseline = page.evaluate("""() => ({
              preset: window.__app.params.galleryPreset,
              bg: window.__app.params.bgMode,
              poly4d: window.__app.params.poly4d,
              morph4d: window.__app.params.morph4d,
              cameraDistance: window.__app.params.cameraDistance,
            })""")
            assert baseline == {
                "preset": "coxeter-rings", "bg": "void",
                "poly4d": "24cell", "morph4d": 0, "cameraDistance": 6,
            }, baseline

            previous = page.locator('[data-act="stepGalleryPreset"][data-arg="-1"]')
            following = page.locator('[data-act="stepGalleryPreset"][data-arg="1"]')
            assert previous.count() == 1 and following.count() == 1
            previous.click()
            prev_state = page.evaluate("() => window.__app.params.galleryPreset")
            assert prev_state == "midnight-600", prev_state
            following = page.locator('[data-act="stepGalleryPreset"][data-arg="1"]')
            assert following.count() == 1
            following.click()
            next_state = page.evaluate("""() => ({
              preset: window.__app.params.galleryPreset,
              label: document.querySelector('.gallery-nav-current span')?.textContent,
              count: document.querySelector('.gallery-nav-current small')?.textContent,
            })""")
            assert next_state == {
                "preset": "coxeter-rings", "label": "Coxeter Rings", "count": "1 / 22",
            }, next_state
            print("ok Gallery arrows wrap, apply presets, and refresh their label")

            removed_sdf_effects = page.evaluate("""() => {
              window.__app.switchView('raymarched');
              const material = window.__app.currentView.object3d.material;
              return {
                acesButton: document.querySelectorAll('[data-act="toggleSDFToneMap"]').length,
                shadowButton: document.querySelectorAll('[data-act="toggleSDFColoredShadow"]').length,
                toneUniform: Object.hasOwn(material.uniforms, 'uToneMap'),
                shadowUniform: Object.hasOwn(material.uniforms, 'uColoredShadow'),
                toneShader: material.fragmentShader.includes('uToneMap'),
                shadowShader: material.fragmentShader.includes('uColoredShadow'),
              };
            }""")
            assert removed_sdf_effects == {
                "acesButton": 0, "shadowButton": 0,
                "toneUniform": False, "shadowUniform": False,
                "toneShader": False, "shadowShader": False,
            }, removed_sdf_effects
            print("ok ACES Tone and Cool Shadow are removed from UI and SDF runtime")

            sdf_quality = page.evaluate("""() => {
              const full = { ...window.__app.currentView.object3d.material.userData.sdfQuality };
              window.__forceSdfSafeMode = true;
              window.__app.switchView('e8coxeter');
              window.__app.switchView('raymarched');
              const safeMaterial = window.__app.currentView.object3d.material;
              const safe = { ...safeMaterial.userData.sdfQuality };
              const shader = safeMaterial.fragmentShader;
              delete window.__forceSdfSafeMode;
              return {
                full,
                safe,
                safeDefines: shader.includes('#define MAX_ROOTS 240')
                  && shader.includes('#define MAX_EDGES 24')
                  && shader.includes('#define MARCH_STEPS 48'),
              };
            }""")
            assert sdf_quality["full"] == {
                "safe": False, "maxRoots": 240, "maxEdges": 64,
                "marchSteps": 72, "shadowSteps": 16, "aoSteps": 3,
                "rootCount": 240, "edgeCount": 64,
            }, sdf_quality
            assert sdf_quality["safe"] == {
                "safe": True, "maxRoots": 240, "maxEdges": 24,
                "marchSteps": 48, "shadowSteps": 6, "aoSteps": 1,
                "rootCount": 240, "edgeCount": 24,
            }, sdf_quality
            assert sdf_quality["safeDefines"], sdf_quality
            print("ok SDF compiles full and constrained-GPU shader budgets")

            services = page.evaluate("""() => {
              const learning = window.__app.getLearningState();
              return {
                quizTotal: learning.summary.quizTotal,
                hasDailyFact: !!learning.dailyFact?.id,
                progressIsPublic: window.__app.progress === learning.progress,
                postcard: window.__app.getPostcardPreviewInfo(),
                canRecord: typeof window.__app.exportClip === 'function',
                canCancel: typeof window.__app.cancelExportClip === 'function',
              };
            }""")
            assert services["quizTotal"] == 8 and services["hasDailyFact"], services
            assert services["progressIsPublic"], services
            assert services["postcard"] == {"width": 1080, "height": 1920}, services
            assert services["canRecord"] and services["canCancel"], services
            print("ok learning/progress and export/recording services are connected")
            browser.close()
    finally:
        httpd.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
