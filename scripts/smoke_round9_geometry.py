#!/usr/bin/env python3
"""Smoke test the Round-9 geometry additions:
  - 4 Kepler–Poinsot stellations render in the Platonic view without errors
  - Extra 4D rotation planes (XZ, YW) don't break the polytope view

Requires the hermes-agent venv python (has playwright).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from verify import (start_server, find_chromium_executable,
                    open_checked_page, assert_canvas_nonblank)

STELLATIONS = [
    'stellated_dodecahedron', 'great_dodecahedron',
    'great_icosahedron', 'great_stellated_dodecahedron',
]


def main() -> int:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        print(f"Playwright required: {exc}")
        return 1

    httpd, base_url = start_server()
    executable = find_chromium_executable()
    try:
        with sync_playwright() as p:
            launch_args = {"headless": True, "args": ["--no-sandbox", "--disable-gpu"]}
            if executable:
                launch_args["executable_path"] = executable
            browser = p.chromium.launch(**launch_args)
            try:
                page, page_errors, console_errors = open_checked_page(
                    browser, base_url + "/index.html", label="round9-geom")

                # ── Stellations ──
                page.evaluate("window.__app.switchView('platonic')")
                page.wait_for_timeout(600)
                for shape in STELLATIONS:
                    page.evaluate(f"window.__app.setShape('{shape}')")
                    page.wait_for_timeout(400)
                    assert_canvas_nonblank(page)
                    cur = page.evaluate("window.__app.params.shape")
                    if cur != shape:
                        print(f"FAIL: shape did not apply for {shape}: got {cur}")
                        return 1
                    print(f"  stellation {shape}: rendered OK")

                # ── Extra 4D rotation planes (Round 9: XZ/YW, Round 10: XW/YZ) ──
                page.evaluate("window.__app.switchView('polytope')")
                page.wait_for_timeout(600)
                # Sweep all 6 planes to confirm no NaN/geometry errors
                for angle in [0.5, 1.2, 2.1, -1.0, 3.0]:
                    page.evaluate(f"window.__app.setParam('polyRotXZ', {angle})")
                    page.evaluate(f"window.__app.setParam('polyRotYW', {angle * 0.7})")
                    page.evaluate(f"window.__app.setParam('polyRotXW', {angle * -0.5})")
                    page.evaluate(f"window.__app.setParam('polyRotYZ', {angle * 1.3})")
                    page.wait_for_timeout(150)
                    assert_canvas_nonblank(page)
                # Reset
                page.evaluate("window.__app.resetPolyAngles()")
                page.wait_for_timeout(300)

                if page_errors or console_errors:
                    print(f"FAIL: errors after geometry sweep:")
                    print(f"  page_errors={page_errors[:5]}")
                    print(f"  console_errors={console_errors[:5]}")
                    return 1
                page.close()
            finally:
                browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()

    print(f"\nAll {len(STELLATIONS)} stellations + 4D rotation planes OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
