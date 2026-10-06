#!/usr/bin/env python3
"""Exercise every curated gallery scene in the hosted desktop build."""
from __future__ import annotations

import time

from playwright.sync_api import sync_playwright

from verify import (
    ROOT,
    assert_canvas_nonblank,
    assert_clean_browser_errors,
    chromium_webgl_args,
    find_chromium_executable,
    open_checked_page,
    start_server,
)


def main() -> None:
    index = ROOT / "dist" / "web" / "index.html"
    if not index.exists():
        raise AssertionError("Build the hosted desktop app before testing gallery presets")

    server, base = start_server()
    try:
        with sync_playwright() as playwright:
            launch = {"headless": True, "args": chromium_webgl_args()}
            executable = find_chromium_executable()
            if executable:
                launch["executable_path"] = executable
            browser = playwright.chromium.launch(**launch)
            try:
                page, page_errors, console_errors = open_checked_page(
                    browser, base + "/dist/web/index.html", label="gallery-presets"
                )
                presets = page.evaluate("() => window.__app.getGalleryPresets().map(({ id, settings }) => ({ id, view: settings.view }))")
                if len(presets) != 24 or len({preset["id"] for preset in presets}) != len(presets):
                    raise AssertionError(f"Expected 24 distinct gallery scenes, got {presets}")

                started = time.monotonic()
                for preset in presets:
                    selected = page.evaluate("""async id => {
                      const app = window.__app;
                      const previousErrors = app.runtimeErrors.length;
                      app.applyGalleryPreset(id);
                      const loadingView = app.currentView;
                      const ready = loadingView?.ready
                        ? await Promise.race([loadingView.ready, new Promise(resolve => setTimeout(() => resolve(false), 10000))])
                        : true;
                      await new Promise(resolve => requestAnimationFrame(resolve));
                      await new Promise(resolve => requestAnimationFrame(resolve));
                      const geometry = app.getGeometryJSON();
                      let numericCount = 0;
                      const invalidNumbers = [];
                      const scan = (value, path) => {
                        if (typeof value === 'number') {
                          numericCount++;
                          if (!Number.isFinite(value)) invalidNumbers.push(path);
                        } else if (Array.isArray(value)) {
                          value.forEach((entry, index) => scan(entry, `${path}[${index}]`));
                        } else if (value && typeof value === 'object') {
                          Object.entries(value).forEach(([key, entry]) => scan(entry, `${path}.${key}`));
                        }
                      };
                      scan(geometry, 'geometry');
                      const canvas = document.getElementById('canvas');
                      return {
                        preset: app.params.galleryPreset,
                        view: app.params.view,
                        ready,
                        attached: !!app.currentView?.object3d?.parent,
                        geometryKind: geometry?.kind || null,
                        featureCount: geometry?.verts?.length || geometry?.roots8d?.length
                          || geometry?.roots?.length || geometry?.tiles?.length
                          || geometry?.nodes?.length || geometry?.points?.length || 0,
                        numericCount,
                        invalidNumbers: invalidNumbers.slice(0, 5),
                        canvas: { width: canvas?.width || 0, height: canvas?.height || 0 },
                        newRuntimeErrors: app.runtimeErrors.slice(previousErrors),
                      };
                    }""", preset["id"])
                    expected_view = "polytope" if preset["view"] == "sixhundred" else preset["view"]
                    if (
                        selected["preset"] != preset["id"]
                        or selected["view"] != expected_view
                        or not selected["ready"]
                        or not selected["attached"]
                        or not selected["geometryKind"]
                        or selected["featureCount"] <= 0
                        or selected["numericCount"] <= 0
                        or selected["invalidNumbers"]
                        or selected["canvas"]["width"] < 2
                        or selected["canvas"]["height"] < 2
                        or selected["newRuntimeErrors"]
                    ):
                        raise AssertionError(f"Gallery scene {preset['id']} failed: {selected}")
                    assert_canvas_nonblank(page)
                    assert_clean_browser_errors(page_errors, console_errors, preset["id"])
                    print(f"  ok {preset['id']}: {selected['view']} / {selected['geometryKind']}")
                    if time.monotonic() - started > 180:
                        raise AssertionError("Gallery sweep exceeded its 180-second budget")

                print(f"Gallery presets passed: {len(presets)} scenes in {time.monotonic() - started:.1f}s")
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
