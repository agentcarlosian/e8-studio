#!/usr/bin/env python3
"""Build dist/e8-studio.html as one portable self-contained file.

Everything needed at runtime is embedded into the HTML: app code, CSS, geometry
data, and the vendored Three/chroma/simplex modules. The generated file can be
sent as a single .html document and opened directly in a modern browser.
"""
from __future__ import annotations

import base64
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
VENDORS = ["three.module.js", "chroma-js.js", "simplex-noise.js"]

IMPORT_BLOCK = (
    'import * as THREE from "./vendor/three.module.js";\n'
    'import chroma from "./vendor/chroma-js.js";\n'
    'import * as simplexNoise from "./vendor/simplex-noise.js";'
)
IMPORTMAP_RE = re.compile(r'\s*<script\s+type="importmap">.*?</script>', re.S)
FONT_LINK_RE = re.compile(
    r'\s*<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>',
    re.I,
)
DATA_FETCH_FALLBACK = "return fetch('./data/' + name + '.json').then(r => r.json());"
DATA_FETCH_STANDALONE_ERROR = "throw new Error('Standalone data bundle is missing: ' + name);"


def vendor_bootstrap() -> str:
    encoded = {
        name: base64.b64encode((DIST / "vendor" / name).read_bytes()).decode("ascii")
        for name in VENDORS
    }
    return f"""const __standaloneDecodeUtf8 = (b64) => {{
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {{
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }}
  return decodeURIComponent(escape(text));
}};
const __standaloneImport = async (label, b64) => {{
  const source = __standaloneDecodeUtf8(b64);
  const url = URL.createObjectURL(new Blob([source], {{ type: "text/javascript" }}));
  try {{
    return await import(url);
  }} catch (error) {{
    console.error(`[standalone] Failed to load ${{label}}`, error);
    throw error;
  }} finally {{
    URL.revokeObjectURL(url);
  }}
}};
const THREE = await __standaloneImport("three.module.js", "{encoded["three.module.js"]}");
const __chromaModule = await __standaloneImport("chroma-js.js", "{encoded["chroma-js.js"]}");
const chroma = __chromaModule.default || __chromaModule;
const simplexNoise = await __standaloneImport("simplex-noise.js", "{encoded["simplex-noise.js"]}");
window.__E8_STUDIO_STANDALONE__ = true;"""


def assert_shareable(html: str) -> None:
    blocked = [
        "./vendor/",
        'src="src/',
        'href="src/',
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
        "manifest.webmanifest",
        "serviceWorker",
        "sw.js",
        DATA_FETCH_FALLBACK,
        "data:text/javascript;base64,",
        "width=device-width",
        "mobile-rail",
        "pointer: coarse",
        "(max-width: 760px)",
        "Phone quality",
    ]
    hits = [snippet for snippet in blocked if snippet in html]
    if hits:
        raise SystemExit(
            "ERROR: standalone HTML still has non-portable dependency markers:\n"
            + "\n".join(f"  - {hit}" for hit in hits)
        )


def main() -> int:
    print("[1/4] Offline build...")
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build_offline.py")],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    html = (DIST / "index.html").read_text(encoding="utf-8")

    print("[2/4] Inlining Three/chroma/simplex as Blob modules...")
    if IMPORT_BLOCK not in html:
        raise SystemExit("ERROR: Expected vendored module import block was not found")
    html = html.replace(IMPORT_BLOCK, vendor_bootstrap(), 1)

    # These served-build features are either unused or actively harmful in a
    # single file opened from file:// or a phone file picker.
    html = IMPORTMAP_RE.sub("", html)
    html = FONT_LINK_RE.sub("", html)
    html = re.sub(r'\s*<link rel="manifest"[^>]*>', "", html)
    html = re.sub(r"\s*<script>\s*if \('serviceWorker'.*?</script>", "", html, flags=re.S)

    # The standalone always embeds INLINE_DATA. If that global is unavailable,
    # do not pretend that ./data exists on the recipient's device.
    html = html.replace(DATA_FETCH_FALLBACK, DATA_FETCH_STANDALONE_ERROR)

    relaxed_csp = (
        "default-src 'self' data: blob: file:; "
        "script-src 'self' 'unsafe-inline' data: blob: file:; "
        "style-src 'self' 'unsafe-inline' data: blob: file:; "
        "font-src 'self' data: blob: file:; "
        "img-src 'self' data: blob: file:; "
        "connect-src 'self' data: blob: file:; "
        "worker-src 'self' data: blob: file:; "
        "object-src 'none'; base-uri 'none'; form-action 'none';"
    )
    html, csp_count = re.subn(
        r'(<meta http-equiv="Content-Security-Policy" content=")(.*?)(">)',
        lambda m: m.group(1) + relaxed_csp + m.group(3),
        html,
        count=1,
        flags=re.S,
    )
    if csp_count == 0:
        print("  WARNING: CSP meta not found to relax")

    assert_shareable(html)

    out = DIST / "e8-studio.html"
    out.write_text(html, encoding="utf-8", newline="\n")
    mb = out.stat().st_size / 1e6
    print(f"[3/4] Wrote {out.relative_to(ROOT)} ({mb:.1f} MB)")
    print("[4/4] Done -- a single self-contained file.\n")
    print("Open it directly in a browser (double-click / file://). No server required.")
    print("No repo files, CDNs, service worker, or web-font requests are required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
