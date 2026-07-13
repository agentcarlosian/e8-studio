#!/usr/bin/env python3
"""Smoke test the 3 Round-9 FX modes (hologram, xray, crystal) on the e8coxeter
view — the heaviest shader user. Confirms each mode compiles (no shader errors
in the console) and the canvas stays non-blank.

Requires the hermes-agent venv python (has playwright).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from verify import (start_server, find_chromium_executable,
                    open_checked_page, assert_canvas_nonblank)

NEW_FX = ['hologram', 'xray', 'crystal']


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
                    browser, base_url + "/index.html", label="new-fx")
                # Cycle through each new FX mode on e8coxeter (points-heavy shader)
                page.evaluate("window.__app.switchView('e8coxeter')")
                page.wait_for_timeout(700)
                for fx in NEW_FX:
                    page.evaluate(f"window.__app.setFX('{fx}')")
                    page.evaluate("window.__app.setParam('fxIntensity', 0.7)")
                    page.wait_for_timeout(500)
                    assert_canvas_nonblank(page)
                    cur = page.evaluate("window.__app.params.fxMode")
                    if cur != fx:
                        print(f"FAIL: fxMode did not apply for {fx}: got {cur}")
                        return 1
                    print(f"  {fx}: rendered OK")
                # Final error check — shader compile errors show up here.
                if page_errors or console_errors:
                    print(f"FAIL: errors after new FX sweep:")
                    print(f"  page_errors={page_errors[:5]}")
                    print(f"  console_errors={console_errors[:5]}")
                    return 1
                page.close()
            finally:
                browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()

    print(f"\nAll {len(NEW_FX)} new FX modes render without errors.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
