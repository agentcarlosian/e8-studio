#!/usr/bin/env python3
"""Build portable desktop HTML from the normal Vite ESM graph.

Both the offline/PWA/Electron page and the share file inline JavaScript, CSS,
and canonical geometry data. This module owns their common source assembly;
scripts/build_offline.py and scripts/build_singlefile.py own the two outputs.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

from build import harden_csp

ROOT = Path(__file__).resolve().parent.parent
DATA_NAMES = ("e8", "e8_math", "platonic", "polytopes4d", "dynkin", "mckay", "mckay_subsets")
CSS_LINK_RE = re.compile(r'<link rel="stylesheet" href="(src/assets/[^"<>]+\.css)">')
ENTRY_RE = re.compile(r'<script type="module" src="src/main\.js"></script>')
IMPORTMAP_RE = re.compile(r'\s*<script type="importmap">[\s\S]*?</script>')
FONT_LINK_RE = re.compile(r'\s*<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>', re.I)
REDIRECT_RE = re.compile(r'\s*<script>if \(location\.protocol === .file:.+?</script>', re.S)


def bundle_desktop_js() -> str:
    node = shutil.which("node")
    if not node:
        raise SystemExit("ERROR: Desktop inline builds require Node.js and npm ci.")
    result = subprocess.run(
        [node, str(ROOT / "scripts" / "bundle_desktop.mjs")],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
    )
    if result.returncode:
        raise SystemExit("ERROR: Could not bundle desktop modules. Run npm ci first.\n" + result.stderr)
    return result.stdout


def inline_data() -> str:
    payload = {
        name: json.loads((ROOT / "data" / f"{name}.json").read_text(encoding="utf-8"))
        for name in DATA_NAMES
    }
    return "window.INLINE_DATA = " + json.dumps(payload, separators=(",", ":")).replace("</", "<\\/") + ";"


def html_without_external_assets() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html, importmap_count = IMPORTMAP_RE.subn("", html)
    html, font_count = FONT_LINK_RE.subn("", html)
    if importmap_count != 1 or font_count < 1:
        raise SystemExit("ERROR: desktop HTML import map/font structure changed")

    css_count = 0

    def inline_css(match: re.Match[str]) -> str:
        nonlocal css_count
        asset = (ROOT / match.group(1)).resolve()
        if not asset.is_relative_to((ROOT / "src" / "assets").resolve()):
            raise SystemExit(f"ERROR: stylesheet outside src/assets: {asset}")
        css_count += 1
        return "<style>\n" + asset.read_text(encoding="utf-8") + "\n</style>"

    html = CSS_LINK_RE.sub(inline_css, html)
    if css_count == 0 or '<link rel="stylesheet"' in html:
        raise SystemExit("ERROR: desktop stylesheet was not inlined")

    script = "<script>\n" + inline_data() + "\n</script>\n"
    script += "<script type=\"module\">\n" + bundle_desktop_js() + "\n</script>"
    html, entry_count = ENTRY_RE.subn(lambda _: script, html)
    if entry_count != 1:
        raise SystemExit("ERROR: desktop ESM entrypoint was not inlined")
    return html


def pin_local_csp(html: str) -> str:
    # Rehash the final inline scripts, then remove allowances that the bundled
    # runtime no longer needs. The dev HTML intentionally still permits CDN use.
    return (harden_csp(html)
            .replace(" https://cdn.jsdelivr.net", "")
            .replace(" https://fonts.googleapis.com", "")
            .replace(" https://fonts.gstatic.com", ""))


def base_html() -> str:
    base_html = html_without_external_assets()
    # The source-file redirect is useful for opening the repository index.html,
    # but a copied share file must never redirect to an absent dist/ sibling.
    base_html, redirects = REDIRECT_RE.subn("", base_html)
    if redirects != 1:
        raise SystemExit("ERROR: expected one source-file redirect")
    return base_html


def write_share_html(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(pin_local_csp(base_html()), encoding="utf-8", newline="\n")


def write_offline_html(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    html = base_html()
    manifest = '<link rel="manifest" href="./manifest.webmanifest">'
    sw_register = (
        "if ('serviceWorker' in navigator) { window.addEventListener('load', () => "
        "navigator.serviceWorker.register('./sw.js').catch(e => console.warn('[pwa]', e))); }"
    )
    offline_html = html.replace("</head>", f"  {manifest}\n</head>", 1)
    offline_html = offline_html.replace("</body>", f"<script>{sw_register}</script>\n</body>", 1)
    offline_html = pin_local_csp(offline_html)
    path.write_text(offline_html, encoding="utf-8", newline="\n")
