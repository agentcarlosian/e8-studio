#!/usr/bin/env python3
"""Render the committed PWA SVG into canonical 192/512 PNG source assets.

The normal offline build copies these assets into dist without a browser.
Run this script after editing assets/pwa-icon.svg, then commit both PNGs.
Use --check to compare the committed PNG bytes without writing files.
"""
from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SVG_SOURCE = ASSETS / "pwa-icon.svg"
sys.path.insert(0, str(ROOT / "scripts"))
from verify import find_chromium_executable  # noqa: E402


def render_icon(page, svg_text: str, size: int) -> bytes:
    """Rasterize committed SVG text without fetching a URL or serving files."""
    encoded = page.evaluate(
        """async ([svg, size]) => {
          const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
          const img = new Image();
          img.decoding = 'sync';
          await new Promise((resolve, reject) => {
            img.onload = resolve; img.onerror = reject; img.src = dataUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          canvas.getContext('2d').drawImage(img, 0, 0, size, size);
          return canvas.toDataURL('image/png').split(',')[1];
        }""",
        [svg_text, size],
    )
    png = base64.b64decode(encoded)
    assert png[:8] == b"\x89PNG\r\n\x1a\n" and png[12:16] == b"IHDR", "browser did not produce PNG"
    assert (int.from_bytes(png[16:20], "big"), int.from_bytes(png[20:24], "big")) == (size, size)
    return png


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify committed PNG bytes without writing")
    args = parser.parse_args()
    if not SVG_SOURCE.is_file():
        print(f"Missing canonical PWA SVG: {SVG_SOURCE}", file=sys.stderr)
        return 1
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        print(f"Playwright required: {exc}", file=sys.stderr)
        return 1

    svg_text = SVG_SOURCE.read_text(encoding="utf-8")
    with sync_playwright() as playwright:
        launch = {"headless": True, "args": ["--no-sandbox", "--disable-gpu"]}
        executable = find_chromium_executable()
        if executable:
            launch["executable_path"] = executable
        browser = playwright.chromium.launch(**launch)
        try:
            page = browser.new_page(viewport={"width": 512, "height": 512})
            for size in (192, 512):
                png = render_icon(page, svg_text, size)
                target = ASSETS / f"pwa-icon-{size}.png"
                if args.check:
                    if not target.is_file() or target.read_bytes() != png:
                        print(f"Canonical PWA icon differs: {target}", file=sys.stderr)
                        return 1
                    print(f"  verified {target.name} ({size}x{size}, {len(png):,} bytes)")
                else:
                    target.write_bytes(png)
                    print(f"  wrote {target.name} ({size}x{size}, {len(png):,} bytes)")
            page.close()
        finally:
            browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
