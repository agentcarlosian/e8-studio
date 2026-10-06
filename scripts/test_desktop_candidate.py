#!/usr/bin/env python3
"""Prove Vite desktop HTML parity before replacing the legacy release builder."""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

import verify
from build_offline import write_pwa_assets

ROOT = Path(__file__).resolve().parent.parent
CANDIDATE = ROOT / "dist" / "desktop-candidate"
PRECACHE = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"]


class QuietHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *_args: object) -> None:
        pass


def check_copied_file(browser, temp_root: Path) -> None:
    copied = temp_root / "copied-studio.html"
    shutil.copyfile(CANDIDATE / "e8-studio.html", copied)
    page = browser.new_page(viewport={"width": 1400, "height": 900})
    page.add_init_script("window.__forceSdfSafeMode = true")
    page_errors: list[str] = []
    console_errors: list[str] = []
    requests: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text)
            if message.type == "error" and not verify.should_ignore_console(message.text) else None)
    page.on("request", lambda request: requests.append(request.url))
    try:
        page.goto(copied.as_uri(), wait_until="commit", timeout=30_000)
        page.wait_for_function("() => window.__app?.startupMetrics?.firstFrameMs != null", timeout=30_000)
        verify.assert_canvas_nonblank(page)
        assert page.url == copied.as_uri(), "copied HTML redirected to a nonexistent dist/ sibling"
        verify.exercise_build_parity(page, page_errors, console_errors, "copied-vite-share")
        page.evaluate("window.__app.switchView('polytope')")
        page.wait_for_function(
            "() => window.__app?.currentView?.name === 'polytope4d' && "
            "window.__app.currentView.object3d.children.length > 0"
        )
        assert not any(url.startswith(("http:", "https:")) for url in requests), requests
        verify.assert_clean_browser_errors(page_errors, console_errors, "copied-vite-share")
        print("  Copied file:// share passed full export parity and deferred 4D view")
    finally:
        page.close()


def check_real_pwa(browser, temp_root: Path) -> None:
    site = temp_root / "site"
    shutil.copytree(CANDIDATE, site)
    handler = partial(QuietHandler, directory=str(site))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_address[1]}/index.html"
    context = browser.new_context(viewport={"width": 1400, "height": 900})
    page = context.new_page()
    page_errors: list[str] = []
    console_errors: list[str] = []
    requests: list[str] = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: requests.append(request.url))
    try:
        page.goto(url, wait_until="commit", timeout=30_000)
        page.wait_for_function("() => window.__app?.startupMetrics?.firstFrameMs != null", timeout=30_000)
        page.wait_for_function("() => !!navigator.serviceWorker.controller", timeout=30_000)
        verify.exercise_build_parity(page, page_errors, console_errors, "vite-pwa-online")
        old_cache = page.evaluate("async () => (await caches.keys()).find(key => key.startsWith('e8-studio-'))")
        assert old_cache, "candidate service worker did not populate its cache"

        # A second build with changed HTML must activate a new cache and serve
        # the new page offline. This uses the actual candidate, not a fixture.
        html = (site / "index.html").read_text(encoding="utf-8")
        (site / "index.html").write_text(html.replace("<title>E8 Studio</title>",
                                                    "<title>E8 Studio revision two</title>", 1),
                                        encoding="utf-8", newline="\n")
        new_cache = write_pwa_assets(site, precache=PRECACHE)
        assert new_cache != old_cache
        page.evaluate("async () => (await navigator.serviceWorker.ready).update()")
        page.wait_for_function("async name => (await caches.keys()).includes(name)", arg=new_cache)
        page.wait_for_function("async name => !(await caches.keys()).includes(name)", arg=old_cache)
        page.reload(wait_until="commit")
        page.wait_for_function("() => document.title === 'E8 Studio revision two'")
        context.set_offline(True)
        page.reload(wait_until="commit")
        page.wait_for_function("() => window.__app?.startupMetrics?.firstFrameMs != null", timeout=30_000)
        assert page.title() == "E8 Studio revision two"
        page.evaluate("window.__app.switchView('polytope')")
        page.wait_for_function("() => window.__app?.currentView?.name === 'polytope4d'")
        assert all(request.startswith(url.rsplit("/", 1)[0]) for request in requests), requests
        verify.assert_clean_browser_errors(page_errors, console_errors, "vite-pwa-offline")
        print("  Actual Vite PWA upgraded, evicted old cache, and reopened offline")
    finally:
        context.close()
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def main() -> int:
    subprocess.run([sys.executable, "-B", "scripts/build_desktop_candidate.py"], cwd=ROOT, check=True)
    for name in ("index.html", "e8-studio.html"):
        production = ROOT / "dist" / name
        candidate = CANDIDATE / name
        assert production.is_file(), f"Build the production {name} first"
        assert production.read_bytes() == candidate.read_bytes(), f"Production {name} differs from parity candidate"
    with tempfile.TemporaryDirectory(prefix="e8-vite-candidate-") as temp:
        with sync_playwright() as playwright:
            launch = {"headless": True, "args": verify.chromium_webgl_args()}
            executable = verify.find_chromium_executable()
            if executable:
                launch["executable_path"] = executable
            browser = playwright.chromium.launch(**launch)
            try:
                temp_root = Path(temp)
                check_copied_file(browser, temp_root)
                check_real_pwa(browser, temp_root)
            finally:
                browser.close()
    print("Desktop Vite candidate parity passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
