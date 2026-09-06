#!/usr/bin/env python3
"""Build dist/e8-studio-mobile-v2.html as one shareable Mobile V2 file.

This is separate from scripts/build_mobile.py on purpose:
- Android packages dist/index.html and should stay lean.
- The desktop standalone remains dist/e8-studio.html from build_singlefile.py.
- This file is for sharing/opening the Mobile V2 phone experience directly.
"""
from __future__ import annotations

import re
from pathlib import Path

from build import harden_csp
from build_mobile import (
    CSS_LINK_RE,
    MOBILE_SCRIPT_RE,
    MOBILE_HTML,
    MOBILE_CSS,
    bundled_mobile_js,
    inline_mobile_data,
    remove_cdn_csp_allowance,
)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "e8-studio-mobile-v2.html"


def main() -> int:
    OUT.parent.mkdir(exist_ok=True)
    html = MOBILE_HTML.read_text(encoding="utf-8")
    css = MOBILE_CSS.read_text(encoding="utf-8")
    js = bundled_mobile_js()

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
