#!/usr/bin/env python3
"""Isolated Android asset-inventory and two-version PWA upgrade checks."""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_mobile  # noqa: E402
from build_offline import pwa_cache_name, write_pwa_assets  # noqa: E402
from verify import find_chromium_executable  # noqa: E402


class NoStoreHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *_args: object) -> None:
        pass


def test_android_inventory(temp_root: Path) -> None:
    config = json.loads((ROOT / "capacitor.config.json").read_text(encoding="utf-8"))
    assert config["webDir"] == "dist/mobile", config["webDir"]
    dist = temp_root / "dist"
    native = dist / "mobile"
    native.mkdir(parents=True)
    (native / "stale.js").write_text("old build", encoding="utf-8")
    (dist / "release-manifest.json").write_text("not native", encoding="utf-8")
    (dist / "e8-studio.html").write_text("share file", encoding="utf-8")
    with patch.object(build_mobile, "ROOT", temp_root):
        output = build_mobile.stage_capacitor_html("<html>native</html>", native)
    assert output.read_text(encoding="utf-8") == "<html>native</html>"
    assert [path.name for path in native.iterdir()] == ["index.html"]
    assert (dist / "release-manifest.json").is_file()
    assert (dist / "e8-studio.html").is_file()
    print("  Android webDir contains only index.html; sibling artifacts remain outside")


def test_built_native_inventory() -> None:
    """Check the exact directory that the next Capacitor sync will copy."""
    config = json.loads((ROOT / "capacitor.config.json").read_text(encoding="utf-8"))
    assert config["webDir"] == "dist/mobile", config["webDir"]
    native = ROOT / config["webDir"]
    assert native.is_dir(), f"run npm run build:mobile first: {native}"
    assert sorted(path.name for path in native.iterdir()) == ["index.html"], list(native.iterdir())
    index = native / "index.html"
    assert index.is_file() and not index.is_symlink()
    assert index.stat().st_size > 100_000, "native HTML is unexpectedly small"
    html = index.read_text(encoding="utf-8")
    assert "window.MOBILE_DATA = " in html, "native data was not inlined"
    assert '<link rel="stylesheet" href=' not in html, "native CSS was not inlined"
    assert '<script type="module" src=' not in html, "native JavaScript was not inlined"
    assert "serviceWorker" not in html, "native HTML registered a PWA worker"
    print(f"  Capacitor input inventory OK: index.html ({index.stat().st_size:,} bytes)")


def write_fixture_index(site: Path, version: str) -> None:
    (site / "index.html").write_text(
        '<!doctype html><html><head><link rel="manifest" href="./manifest.webmanifest"></head>'
        f'<body><main id="version">{version}</main><script>'
        "navigator.serviceWorker.register('./sw.js');"
        "</script></body></html>",
        encoding="utf-8",
    )


def test_manifest_icon_inventory(temp_root: Path) -> None:
    site = temp_root / "icons"
    site.mkdir()
    write_fixture_index(site, "icon inventory")
    # Stale output must be replaced with the committed canonical icon bytes.
    (site / "icon-192.png").write_bytes(b"stale")
    (site / "icon-512.png").write_bytes(b"stale")
    first_cache = write_pwa_assets(site)
    assert first_cache == write_pwa_assets(site), "identical icons changed the PWA revision"
    manifest = json.loads((site / "manifest.webmanifest").read_text(encoding="utf-8"))
    assert {icon["src"] for icon in manifest["icons"]} == {
        "./icon.svg", "./icon-192.png", "./icon-512.png"}, manifest["icons"]
    assert all((site / icon["src"].removeprefix("./")).is_file() for icon in manifest["icons"])
    worker = (site / "sw.js").read_text(encoding="utf-8")
    for size in (192, 512):
        name = f"icon-{size}.png"
        data = (site / name).read_bytes()
        assert data == (ROOT / "assets" / f"pwa-{name}").read_bytes(), name
        assert data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR", name
        assert (int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")) == (size, size), name
        assert f'"./{name}"' in worker, f"{name} was not precached"
    print("  PWA manifest emits canonical 192/512 PNG icons and precaches every icon")


def test_pwa_upgrade(temp_root: Path) -> None:
    site = temp_root / "site"
    site.mkdir(parents=True)

    write_fixture_index(site, "version one")
    old_cache = write_pwa_assets(site)
    assert old_cache == write_pwa_assets(site), "identical build changed cache revision"

    from playwright.sync_api import sync_playwright

    handler = partial(NoStoreHandler, directory=str(site))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_address[1]}/index.html"
    try:
        with sync_playwright() as playwright:
            launch = {"headless": True, "args": ["--no-sandbox", "--disable-gpu"]}
            executable = find_chromium_executable()
            if executable:
                launch["executable_path"] = executable
            browser = playwright.chromium.launch(**launch)
            try:
                context = browser.new_context()
                page = context.new_page()
                page.goto(url, wait_until="load")
                page.wait_for_function("() => !!navigator.serviceWorker.controller")
                assert page.locator("#version").inner_text() == "version one"
                page.evaluate(
                    """async () => {
                      const unrelated = await caches.open('unrelated-app-cache');
                      await unrelated.put('./sentinel', new Response('keep'));
                    }"""
                )

                write_fixture_index(site, "version two")
                page.reload(wait_until="load")
                assert page.locator("#version").inner_text() == "version two", "online navigation served stale HTML"
                new_cache = write_pwa_assets(site)
                assert new_cache != old_cache, "changed HTML retained stale cache revision"
                page.evaluate("async () => (await navigator.serviceWorker.ready).update()")
                page.wait_for_function(
                    """async name => (await caches.keys()).includes(name)""",
                    arg=new_cache,
                )
                page.wait_for_function(
                    """async name => !(await caches.keys()).includes(name)""",
                    arg=old_cache,
                )
                page.reload(wait_until="load")
                assert page.locator("#version").inner_text() == "version two"
                cache_names = page.evaluate("async () => caches.keys()")
                assert "unrelated-app-cache" in cache_names, cache_names

                context.set_offline(True)
                page.reload(wait_until="load")
                assert page.locator("#version").inner_text() == "version two"
                print("  PWA upgraded to second build, retained unrelated cache, and reloaded offline")
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_pwa_scope_isolation(temp_root: Path) -> None:
    """Two installs on one origin must retain independent offline revisions."""
    site = temp_root / "scoped-site"
    alpha = site / "alpha"
    beta = site / "beta"
    alpha.mkdir(parents=True)
    beta.mkdir()
    write_fixture_index(alpha, "alpha one")
    write_fixture_index(beta, "beta one")
    write_pwa_assets(alpha)
    write_pwa_assets(beta)
    old_alpha = pwa_cache_name(alpha, scope_path="/alpha/")
    old_beta = pwa_cache_name(beta, scope_path="/beta/")
    assert old_alpha != old_beta

    handler = partial(NoStoreHandler, directory=str(site))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as playwright:
            launch = {"headless": True, "args": ["--no-sandbox", "--disable-gpu"]}
            executable = find_chromium_executable()
            if executable:
                launch["executable_path"] = executable
            browser = playwright.chromium.launch(**launch)
            try:
                context = browser.new_context()
                alpha_page = context.new_page()
                beta_page = context.new_page()
                alpha_page.goto(base + "/alpha/index.html", wait_until="load")
                beta_page.goto(base + "/beta/index.html", wait_until="load")
                alpha_page.wait_for_function("() => !!navigator.serviceWorker.controller")
                beta_page.wait_for_function("() => !!navigator.serviceWorker.controller")
                keys = alpha_page.evaluate("async () => caches.keys()")
                assert old_alpha in keys and old_beta in keys, keys

                write_fixture_index(alpha, "alpha two")
                alpha_page.reload(wait_until="load")
                assert alpha_page.locator("#version").inner_text() == "alpha two"
                write_pwa_assets(alpha)
                new_alpha = pwa_cache_name(alpha, scope_path="/alpha/")
                assert new_alpha != old_alpha
                alpha_page.evaluate("async () => (await navigator.serviceWorker.ready).update()")
                alpha_page.wait_for_function("async name => (await caches.keys()).includes(name)", arg=new_alpha)
                alpha_page.wait_for_function("async name => !(await caches.keys()).includes(name)", arg=old_alpha)
                keys = alpha_page.evaluate("async () => caches.keys()")
                assert old_beta in keys, f"alpha update evicted beta cache: {keys}"

                context.set_offline(True)
                alpha_page.reload(wait_until="load")
                beta_page.reload(wait_until="load")
                assert alpha_page.locator("#version").inner_text() == "alpha two"
                assert beta_page.locator("#version").inner_text() == "beta one"
                expected_icon_bytes = {
                    name: (ROOT / "assets" / f"pwa-{name}").stat().st_size
                    for name in ("icon.svg", "icon-192.png", "icon-512.png")
                }
                for page in (alpha_page, beta_page):
                    offline_icons = page.evaluate("""async () => {
                      const result = {};
                      for (const name of ['icon.svg', 'icon-192.png', 'icon-512.png']) {
                        const response = await fetch('./' + name);
                        result[name] = response.ok ? (await response.arrayBuffer()).byteLength : -1;
                      }
                      return result;
                    }""")
                    assert offline_icons == expected_icon_bytes, offline_icons
                print("  two PWA scopes on one origin retain independent caches after upgrade and offline reload")
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--native-only", action="store_true", help="check the real dist/mobile build without launching a browser")
    args = parser.parse_args()
    if args.native_only:
        test_built_native_inventory()
        print("Native asset inventory passed.")
        return 0
    with tempfile.TemporaryDirectory(prefix="e8-packaging-") as temporary:
        root = Path(temporary)
        test_android_inventory(root)
        test_manifest_icon_inventory(root)
        test_pwa_upgrade(root)
        test_pwa_scope_isolation(root)
    print("Packaging asset checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
