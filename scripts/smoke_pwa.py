#!/usr/bin/env python3
"""Smoke test the PWA layer of the offline dist:
  - manifest.webmanifest is reachable and parses
  - sw.js is reachable
  - icon assets exist
  - the app loads + the service worker registers (over http, where SW works)

This checks the generated application's PWA plumbing. The isolated
test_packaging_assets.py exercises a two-build upgrade and an offline reload
in Chromium without changing this shared dist directory.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from verify import start_server, find_chromium_executable  # noqa: E402


def main() -> int:
    # Static asset checks (no browser needed)
    dist = ROOT / "dist"
    # Every manifest icon is emitted by the normal build and available offline.
    required = ["manifest.webmanifest", "sw.js", "icon.svg", "icon-192.png", "icon-512.png"]
    missing = [f for f in required if not (dist / f).exists()]
    if missing:
        print(f"FAIL: missing PWA assets: {missing}")
        return 1
    for size in (192, 512):
        data = (dist / f"icon-{size}.png").read_bytes()
        assert data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR", f"invalid {size}px PNG"
        assert (int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")) == (size, size), f"wrong {size}px PNG size"
    manifest = json.loads((dist / "manifest.webmanifest").read_text(encoding="utf-8"))
    assert manifest["short_name"], "manifest missing short_name"
    assert manifest["start_url"], "manifest missing start_url"
    assert len(manifest["icons"]) >= 2, "manifest needs at least 2 icons"
    for icon in manifest["icons"]:
        src = icon["src"]
        assert src.startswith("./"), f"manifest icon must be a local relative path: {src}"
        asset = (dist / src[2:]).resolve()
        assert asset.is_relative_to(dist.resolve()) and asset.is_file(), f"manifest icon is missing: {src}"
    print(f"  manifest OK ({manifest['short_name']}, {len(manifest['icons'])} icons)")
    print(f"  all {len(required)} PWA assets present")

    # Browser checks: manifest + SW reachable + registration
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        print(f"(skipping browser checks — no playwright: {exc})")
        return 0

    httpd, base_url = start_server()
    executable = find_chromium_executable()
    try:
        with sync_playwright() as p:
            launch_args = {"headless": True, "args": ["--no-sandbox", "--disable-gpu"]}
            if executable:
                launch_args["executable_path"] = executable
            browser = p.chromium.launch(**launch_args)
            try:
                ctx = browser.new_context()
                page = ctx.new_page()
                page.goto(f"{base_url}/dist/index.html", timeout=20000,
                          wait_until="commit")
                page.wait_for_function(
                    "() => !!(window.__app && window.__app.params)",
                    timeout=20000)
                # Confirm the manifest link is wired in the page
                ml = page.evaluate(
                    "() => !!document.querySelector('link[rel=manifest]')")
                if not ml:
                    print("FAIL: manifest <link> not injected")
                    return 1
                # Give the SW a moment to register
                page.wait_for_timeout(1500)
                sw_count = page.evaluate(
                    """async () => {
                      if (!navigator.serviceWorker) return -1;
                      const regs = await navigator.serviceWorker.getRegistrations();
                      return regs.length;
                    }""")
                if sw_count < 1:
                    print(f"FAIL: service worker did not register (count={sw_count})")
                    return 1
                print(f"  manifest <link> injected OK")
                print(f"  service worker registered ({sw_count}) OK")
                page.close()
            finally:
                browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()

    print("\nPWA layer verified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
