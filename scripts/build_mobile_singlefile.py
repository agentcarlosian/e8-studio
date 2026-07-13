#!/usr/bin/env python3
"""Build dist/e8-studio-mobile-v2.html as one shareable Mobile V2 file.

This is separate from scripts/build_mobile.py on purpose:
- Android packages dist/index.html and should stay lean.
- The desktop standalone remains dist/e8-studio.html from build_singlefile.py.
- This file is for sharing/opening the Mobile V2 phone experience directly.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from build import harden_csp

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "e8-studio-mobile-v2.html"
MOBILE_HTML = ROOT / "mobile.html"
MOBILE_CSS = ROOT / "src" / "mobile" / "style.css"
MOBILE_JS = ROOT / "src" / "mobile" / "main.js"

CSS_LINK_RE = re.compile(r'<link\s+rel="stylesheet"\s+href="src/mobile/style\.css"\s*>')
MOBILE_SCRIPT_RE = re.compile(r'<script\s+type="module"\s+src="src/mobile/main\.js"></script>')
LOAD_DATA_RE = re.compile(
    r"async function loadData\(\) \{\n"
    r"  if \(window\.MOBILE_DATA\) return window\.MOBILE_DATA;\n"
    r".*?\n"
    r"\}\n\n"
    r"function cacheElements\(",
    re.S,
)


def inline_mobile_data() -> str:
    payload = {
        "e8": json.loads((ROOT / "data" / "e8.json").read_text(encoding="utf-8")),
        "e8_math": json.loads((ROOT / "data" / "e8_math.json").read_text(encoding="utf-8")),
        "mckay_subsets": json.loads((ROOT / "data" / "mckay_subsets.json").read_text(encoding="utf-8")),
        "platonic": json.loads((ROOT / "data" / "platonic.json").read_text(encoding="utf-8")),
        "polytopes4d": json.loads((ROOT / "data" / "polytopes4d.json").read_text(encoding="utf-8")),
        "dynkin": json.loads((ROOT / "data" / "dynkin.json").read_text(encoding="utf-8")),
        "mckay": json.loads((ROOT / "data" / "mckay.json").read_text(encoding="utf-8")),
        "curriculum": json.loads((ROOT / "data" / "curriculum.json").read_text(encoding="utf-8")),
    }
    return "window.MOBILE_DATA = " + json.dumps(payload, separators=(",", ":")) + ";\n"


def remove_data_fetch_fallback(js: str) -> str:
    replacement = (
        "async function loadData() {\n"
        "  if (window.MOBILE_DATA) return window.MOBILE_DATA;\n"
        "  throw new Error('Mobile standalone data bundle is missing.');\n"
        "}\n\n"
        "function cacheElements("
    )
    next_js, count = LOAD_DATA_RE.subn(replacement, js, count=1)
    if count != 1:
        raise SystemExit("ERROR: Could not remove Mobile V2 standalone data fetch fallback")
    return next_js


def remove_cdn_csp_allowance(html: str) -> str:
    return html.replace(" https://cdn.jsdelivr.net", "")


def main() -> int:
    OUT.parent.mkdir(exist_ok=True)
    html = MOBILE_HTML.read_text(encoding="utf-8")
    css = MOBILE_CSS.read_text(encoding="utf-8")
    js = remove_data_fetch_fallback(MOBILE_JS.read_text(encoding="utf-8"))

    html, css_count = CSS_LINK_RE.subn(f"<style>\n/* src/mobile/style.css */\n{css}\n</style>", html)
    script_replacement = (
        "<script>\n" + inline_mobile_data() + "</script>\n"
        "<script type=\"module\">\n/* src/mobile/main.js */\n" + js + "\n</script>"
    )
    html, js_count = MOBILE_SCRIPT_RE.subn(lambda _match: script_replacement, html)
    if css_count != 1 or js_count != 1:
        raise SystemExit("ERROR: Could not inline Mobile V2 CSS/JS entrypoint")

    html = remove_cdn_csp_allowance(harden_csp(html))
    html = re.sub(r"\s*frame-ancestors[^;]*;", "", html)
    OUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"Mobile V2 standalone written: {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")
    print("Open directly in a browser or host as a static file. No network required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
