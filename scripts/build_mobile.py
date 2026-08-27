#!/usr/bin/env python3
"""Build dist/ for the Android-first Mobile V2 shell.

The desktop Studio keeps using index.html/src/main.js. Native Android ships a
small hybrid mobile entrypoint: Canvas 2D handles the lightweight scenes and a
raw WebGL raymarcher handles E8 SDF. This build inlines Mobile V2 CSS/JS plus the E8 data it needs into
dist/index.html and removes stale browser/PWA artifacts from previous builds.
Shareable standalone files in dist/ are preserved so Android/mobile builds do
not erase files intended for manual sharing.
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

from build import harden_csp

ROOT = Path(__file__).resolve().parent.parent
DIST_INDEX = ROOT / "dist" / "index.html"
MOBILE_HTML = ROOT / "mobile.html"
MOBILE_CSS = ROOT / "src" / "mobile" / "style.css"
MOBILE_JS = ROOT / "src" / "mobile" / "main.js"
RANK2_JS = ROOT / "src" / "math" / "rank2-roots.js"
TILING_JS = ROOT / "src" / "math" / "coxeter-tilings.js"
QUASICRYSTAL_JS = ROOT / "src" / "math" / "e8-quasicrystal.js"
PROTECTED_DIST_ARTIFACTS = [
    ROOT / "dist" / "e8-studio.html",
    ROOT / "dist" / "e8-studio-mobile-v2.html",
]
STALE_FILES = [
    ROOT / "dist" / "sw.js",
    ROOT / "dist" / "manifest.webmanifest",
    ROOT / "dist" / "icon.svg",
    ROOT / "dist" / "icon-192.png",
    ROOT / "dist" / "icon-512.png",
]
STALE_DIRS = [ROOT / "dist" / "vendor"]

CSS_LINK_RE = re.compile(r'<link\s+rel="stylesheet"\s+href="src/mobile/style\.css"\s*>')
MOBILE_SCRIPT_RE = re.compile(r'<script\s+type="module"\s+src="src/mobile/main\.js"></script>')
RANK2_IMPORT_RE = re.compile(r"^import\s*\{.*?\}\s*from\s*['\"]\.\./math/rank2-roots\.js['\"];?\s*", re.M | re.S)
TILING_RANK2_IMPORT_RE = re.compile(r"^import\s*\{.*?\}\s*from\s*['\"]\./rank2-roots\.js['\"];?\s*", re.M | re.S)
TILING_IMPORT_RE = re.compile(r"^import\s*\{.*?\}\s*from\s*['\"]\.\./math/coxeter-tilings\.js['\"];?\s*", re.M | re.S)
QUASICRYSTAL_IMPORT_RE = re.compile(r"^import\s*\{.*?\}\s*from\s*['\"]\.\./math/e8-quasicrystal\.js['\"];?\s*", re.M | re.S)


def bundled_mobile_js() -> str:
    rank2 = re.sub(r"\bexport\s+(?=(?:const|function|class)\b)", "", RANK2_JS.read_text(encoding="utf-8"))
    tiling = TILING_JS.read_text(encoding="utf-8")
    tiling, tiling_rank2_count = TILING_RANK2_IMPORT_RE.subn("", tiling, count=1)
    if tiling_rank2_count != 1:
        raise SystemExit("ERROR: Could not inline the tiling module's rank-2 dependency")
    tiling = re.sub(r"\bexport\s+(?=(?:const|function|class)\b)", "", tiling)
    quasicrystal = re.sub(r"\bexport\s+(?=(?:const|function|class)\b)", "", QUASICRYSTAL_JS.read_text(encoding="utf-8"))
    quasicrystal = "const { QUASICRYSTAL_REACHES, generateE8Quasicrystal, quasicrystalReliefHeight } = (() => {\n" + quasicrystal + "\nreturn { QUASICRYSTAL_REACHES, generateE8Quasicrystal, quasicrystalReliefHeight };\n})();"
    mobile = MOBILE_JS.read_text(encoding="utf-8")
    mobile, rank2_count = RANK2_IMPORT_RE.subn("", mobile, count=1)
    mobile, tiling_count = TILING_IMPORT_RE.subn("", mobile, count=1)
    mobile, quasicrystal_count = QUASICRYSTAL_IMPORT_RE.subn("", mobile, count=1)
    if rank2_count != 1:
        raise SystemExit("ERROR: Could not inline the rank-2 root-system module")
    if tiling_count != 1:
        raise SystemExit("ERROR: Could not inline the Coxeter tiling module")
    if quasicrystal_count != 1:
        raise SystemExit("ERROR: Could not inline the E8 quasicrystal module")
    return rank2 + "\n\n" + tiling + "\n\n" + quasicrystal + "\n\n" + mobile

def inline_mobile_data() -> str:
    payload = {
        "e8": json.loads((ROOT / "data" / "e8.json").read_text(encoding="utf-8")),
        "e8_math": json.loads((ROOT / "data" / "e8_math.json").read_text(encoding="utf-8")),
        "mckay_subsets": json.loads((ROOT / "data" / "mckay_subsets.json").read_text(encoding="utf-8")),
        "platonic": json.loads((ROOT / "data" / "platonic.json").read_text(encoding="utf-8")),
        "stellations": json.loads((ROOT / "data" / "stellations.json").read_text(encoding="utf-8")),
        "polytopes4d": json.loads((ROOT / "data" / "polytopes4d.json").read_text(encoding="utf-8")),
        "dynkin": json.loads((ROOT / "data" / "dynkin.json").read_text(encoding="utf-8")),
        "mckay": json.loads((ROOT / "data" / "mckay.json").read_text(encoding="utf-8")),
        "curriculum": json.loads((ROOT / "data" / "curriculum.json").read_text(encoding="utf-8")),
    }
    return "window.MOBILE_DATA = " + json.dumps(payload, separators=(",", ":")) + ";\n"


def path_contains(parent: Path, child: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def assert_cleanup_is_safe() -> None:
    protected = [path.resolve() for path in PROTECTED_DIST_ARTIFACTS]
    stale_files = [path.resolve() for path in STALE_FILES]
    for path in stale_files:
        if path in protected:
            raise SystemExit(f"ERROR: mobile cleanup attempted to remove protected share artifact: {path.relative_to(ROOT)}")
    for stale_dir in STALE_DIRS:
        for protected_file in PROTECTED_DIST_ARTIFACTS:
            if path_contains(stale_dir, protected_file):
                raise SystemExit(f"ERROR: mobile cleanup directory would remove protected share artifact: {protected_file.relative_to(ROOT)}")


def remove_cdn_csp_allowance(html: str) -> str:
    return html.replace(" https://cdn.jsdelivr.net", "")


def remove_stale_artifacts() -> None:
    assert_cleanup_is_safe()
    for path in STALE_FILES:
        if path.exists():
            path.unlink()
            print(f"Removed stale mobile artifact: {path.relative_to(ROOT)}")
    for path in STALE_DIRS:
        if path.exists():
            shutil.rmtree(path)
            print(f"Removed stale mobile directory: {path.relative_to(ROOT)}")


def main() -> int:
    DIST_INDEX.parent.mkdir(exist_ok=True)
    remove_stale_artifacts()
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
    DIST_INDEX.write_text(html, encoding="utf-8", newline="\n")
    print(f"Mobile V2 dist written: {DIST_INDEX.relative_to(ROOT)} ({DIST_INDEX.stat().st_size:,} bytes)")
    print("Mobile bundle uses Canvas 2D + raw WebGL E8 chords/Quasicrystal/SDF, inlined E8 data, and no PWA service worker.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
