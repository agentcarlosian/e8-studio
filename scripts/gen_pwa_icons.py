#!/usr/bin/env python3
"""Generate PWA PNG icons (192 + 512) from dist/icon.svg using a headless
browser. The SVG is rendered to a canvas at the target size and exported as
PNG. Run after build_offline.py (which writes the SVG icon).

Usage:
  python scripts/gen_pwa_icons.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from verify import start_server, find_chromium_executable  # noqa: E402

DIST = ROOT / "dist"


def render_icon(page, svg_url: str, size: int) -> bytes:
    """Render the SVG at svg_url into a PNG of the given square size.

    Loads the SVG as a data URL (fetch + base64) to avoid canvas tainting from
    cross-origin img elements. The data URL is same-origin by construction so
    toDataURL succeeds.
    """
    b64 = page.evaluate(
        """async ([url, size]) => {
          const resp = await fetch(url);
          const text = await resp.text();
          const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)));
          const img = new Image();
          img.decoding = 'sync';
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, size, size);
          const out = canvas.toDataURL('image/png');
          return out.split(',')[1];
        }""",
        [svg_url, size],
    )
    import base64
    return base64.b64decode(b64)


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
                page = browser.new_page(viewport={"width": 512, "height": 512})
                # Navigate to the server root (same-origin) so the fetch() inside
                # render_icon isn't cross-origin.
                page.goto(f"{base_url}/dist/manifest.webmanifest", timeout=15000)
                svg_url = f"{base_url}/dist/icon.svg"
                for size in (192, 512):
                    png = render_icon(page, svg_url, size)
                    out = DIST / f"icon-{size}.png"
                    out.write_bytes(png)
                    print(f"  wrote {out.name} ({len(png):,} bytes)")
                page.close()
            finally:
                browser.close()
    finally:
        httpd.shutdown()
        httpd.server_close()

    print("\nPWA icons generated in dist/.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
