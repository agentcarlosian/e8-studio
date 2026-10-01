"""A Static/No FX Coxeter scene stays still until Ambient drift is chosen."""
from __future__ import annotations

import base64
import json

from playwright.sync_api import sync_playwright

from verify import start_server, find_chromium_executable, chromium_webgl_args


def camera_span(page) -> float:
    return page.evaluate("""async () => {
      const points = [];
      for (let i = 0; i < 20; i++) {
        await new Promise(requestAnimationFrame);
        points.push(window.__app.camera.position.toArray());
      }
      return Math.max(...points.map(point => Math.hypot(
        ...point.map((value, axis) => value - points[0][axis]))));
    }""")


def main() -> None:
    server, base = start_server()
    try:
        with sync_playwright() as playwright:
            launch = {"headless": True, "args": chromium_webgl_args()}
            executable = find_chromium_executable()
            if executable:
                launch["executable_path"] = executable
            browser = playwright.chromium.launch(**launch)
            try:
                legacy = {"view": "e8coxeter", "shiftMode": "static", "fxMode": "none",
                          "showAmbient": True, "autoRotate": False, "cameraOrbit": False}
                context = browser.new_context(
                    viewport={"width": 1280, "height": 800}, reduced_motion="no-preference",
                    storage_state={"cookies": [], "origins": [{"origin": base, "localStorage": [
                        {"name": "e8_studio_config_v1", "value": json.dumps(legacy)}]}]},
                )
                page = context.new_page()
                errors: list[str] = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(base + "/dist/web/index.html", wait_until="domcontentloaded")
                page.wait_for_function("() => window.__app?.currentView?.name === 'e8coxeter'")
                state = page.evaluate("""() => ({
                  shift: window.__app.params.shiftMode,
                  fx: window.__app.params.fxMode,
                  ambient: window.__app.params.showAmbient,
                  explicit: window.__app.params.ambientMotionExplicit,
                })""")
                assert state == {"shift": "static", "fx": "none", "ambient": False, "explicit": False}, state
                page.wait_for_function("""() => JSON.parse(localStorage.getItem('e8_studio_config_v1')).showAmbient === false""")
                page.evaluate("""() => {
                  const app = window.__app;
                  for (const [key, value] of Object.entries({
                    intro:false, autoModel:false, autoRotate:false, e8AutoRotate:false,
                    cameraOrbit:false, autoZoom:false, autoFx:false, shiftMode:'static',
                    fxMode:'none', cameraPath:'manual', bgMode:'void', autoSliders:[],
                    adaptivePixelRatio:false,
                  })) app.setParam(key, value, {save:false});
                }""")
                page.mouse.move(0, 0)
                page.wait_for_timeout(800)  # optional highlight data and first-frame work settle
                page.wait_for_function("() => document.querySelector('#ps-motion')?.dataset.motionKey === 'idle'")
                assert camera_span(page) < 1e-10, "idle camera drifted despite Static/No FX"
                frames = []
                for _ in range(4):
                    frames.append(page.locator("#canvas").screenshot())
                    page.wait_for_timeout(180)
                assert len(set(frames)) == 1, "Coxeter canvas changed in its still state"

                button = page.locator('[data-act="toggleAmbientMotion"]')
                assert button.get_attribute("aria-pressed") == "false"
                button.click()
                page.wait_for_function("() => window.__app.params.showAmbient && window.__app.params.ambientMotionExplicit")
                assert button.get_attribute("aria-pressed") == "true"
                page.wait_for_function("() => document.querySelector('#ps-motion')?.dataset.motionKey === 'ambient'")
                assert camera_span(page) > 1e-6, "opted-in ambient motion did not move the camera"
                page.wait_for_function("""() => {
                  const saved = JSON.parse(localStorage.getItem('e8_studio_config_v1') || '{}');
                  return saved.showAmbient === true && saved.ambientMotionExplicit === true;
                }""")
                page.reload(wait_until="domcontentloaded")
                page.wait_for_function("() => !!window.__app?.currentView")
                assert page.evaluate("() => window.__app.params.showAmbient === true"), "explicit motion choice did not persist"
                page.locator('[data-act="toggleAmbientMotion"]').click()
                assert page.evaluate("() => window.__app.params.showAmbient === false")
                page.evaluate("() => window.__app.switchView('platonic')")
                page.evaluate("() => window.__app.switchView('e8coxeter')")
                assert page.evaluate("() => window.__app.params.showAmbient === false"), "view selection re-enabled ambient motion"
                assert not errors, errors
                context.close()
                for explicit in (False, True):
                    shared = {**legacy, **({"ambientMotionExplicit": True} if explicit else {})}
                    code = base64.urlsafe_b64encode(json.dumps(shared).encode()).decode().rstrip('=')
                    linked = browser.new_page(viewport={"width": 1280, "height": 800})
                    linked.goto(base + "/dist/web/index.html#scene=v1." + code, wait_until="domcontentloaded")
                    linked.wait_for_function("() => !!window.__app?.currentView")
                    assert linked.evaluate("() => window.__app.params.showAmbient") is explicit, \
                        "scene link did not distinguish legacy drift from an explicit choice"
                    if not explicit:
                        linked.evaluate("() => window.__app.setParam('showAmbient', true, {save:false})")
                        assert linked.evaluate("() => window.__app.params.ambientMotionExplicit === true"), \
                            "public setting did not mark ambient motion as an explicit choice"
                    linked.close()
                print("Coxeter stability passed: legacy motion migrated, still canvas, explicit opt-in, saved choice, and view reset.")
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
