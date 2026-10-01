#!/usr/bin/env python3
"""Local Playwright WebKit smoke for the hosted Studio at desktop and phone widths.

This checks the WebKit engine, not a physical iPhone/iPad or Safari release.
Run after `npm run build:web`.
"""
from __future__ import annotations

from playwright.sync_api import sync_playwright

from verify import start_server


def main() -> None:
    server, base = start_server()
    try:
        with sync_playwright() as playwright:
            browser = playwright.webkit.launch(headless=True)
            try:
                for width, height in ((1440, 900), (390, 844)):
                    context = browser.new_context(
                        viewport={"width": width, "height": height},
                        reduced_motion="reduce",
                        is_mobile=width < 400,
                        has_touch=width < 400,
                    )
                    page = context.new_page()
                    errors: list[str] = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(base + "/dist/web/index.html", wait_until="domcontentloaded")
                    page.wait_for_function(
                        "() => !!window.__app?.currentView || window.__mobileApp?.getMetrics()?.firstRenderMs != null",
                        timeout=60_000,
                    )
                    if page.evaluate("() => !!window.__app?.currentView"):
                        assert page.evaluate("() => window.__app.params.view") == "e8coxeter"
                        page.evaluate("() => window.__app.openLearningCenter('meet-e8')")
                        assert page.locator("#learning-lesson-title").inner_text() == "What am I looking at?"
                        page.keyboard.press("Escape")
                        assert page.locator("#learning-modal").evaluate("el => el.classList.contains('hidden')")
                        page.evaluate("view => window.__app.switchView(view)", "quasicrystal")
                        geometry = page.evaluate("() => window.__app.getGeometryJSON()")
                        assert geometry["kind"] == "e8-cut-and-project" and len(geometry["points"]) > 0
                        route = "WebGL Studio"
                    else:
                        assert page.url.endswith("/dist/web/mobile.html"), page.url
                        assert page.evaluate("() => window.__mobileApp.getMetrics().firstRenderMs") >= 0
                        route = "Canvas2D fallback"
                    assert not errors, {"width": width, "errors": errors}
                    print(f"  {width}px: {route}")
                    context.close()
                context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
                page = context.new_page()
                page.add_init_script("""
                  const original = HTMLCanvasElement.prototype.getContext;
                  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
                    if (['webgl', 'webgl2', 'experimental-webgl'].includes(kind)) return null;
                    return original.call(this, kind, ...args);
                  };
                """)
                page.goto(base + "/dist/web/index.html", wait_until="domcontentloaded")
                button = page.locator('#render-fallback [data-act="openCanvas2DStudio"]')
                button.wait_for(timeout=60_000)
                button.click()
                page.wait_for_url("**/dist/web/mobile.html")
                page.wait_for_function(
                    "() => window.__mobileApp?.getMetrics()?.firstRenderMs != null",
                    timeout=60_000,
                )
                assert page.url.endswith("/dist/web/mobile.html"), page.url
                print("  forced no-WebGL: Canvas2D fallback")
                context.close()
                print("WebKit engine passed: desktop and phone boot with supported route checks.")
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
