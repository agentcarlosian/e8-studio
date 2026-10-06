#!/usr/bin/env python3
"""Build the Android-first Mobile V2 shell.

The desktop Studio keeps using index.html/src/main.js. Native Android ships a
small hybrid mobile entrypoint: Canvas 2D handles the lightweight scenes and a
raw WebGL raymarcher handles E8 SDF. This build inlines Mobile V2 CSS/JS and
data into dist/index.html for browser smoke tests and dist/mobile/index.html
for Capacitor. The native directory is recreated with only that one file, so
other dist artifacts cannot enter the Android package.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

from build import harden_csp

ROOT = Path(__file__).resolve().parent.parent
DIST_INDEX = ROOT / "dist" / "index.html"
CAPACITOR_WEB_DIR = ROOT / "dist" / "mobile"
MOBILE_HTML = ROOT / "mobile.html"
MOBILE_CSS = ROOT / "src" / "mobile" / "style.css"
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


def bundled_mobile_js() -> str:
    """Compile normal ESM imports once for either inline mobile HTML target."""
    node = shutil.which("node")
    if not node:
        raise SystemExit("ERROR: Mobile builds require Node.js and npm ci.")
    result = subprocess.run(
        [node, str(ROOT / "scripts" / "bundle_mobile.mjs")],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
    )
    if result.returncode:
        raise SystemExit("ERROR: Could not bundle mobile modules. Run npm ci first.\n" + result.stderr)
    return result.stdout


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
    # JSON is embedded inside an HTML script element. A lesson containing a
    # literal closing tag must not end that element before the bundle runs.
    return "window.MOBILE_DATA = " + json.dumps(payload, separators=(",", ":")).replace("</", "<\\/") + ";\n"


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


def stage_capacitor_html(html: str, output_dir: Path = CAPACITOR_WEB_DIR) -> Path:
    """Replace the native web directory with the single intended HTML file."""
    workspace = ROOT.resolve()
    resolved = output_dir.resolve()
    try:
        relative = resolved.relative_to(workspace)
    except ValueError as exc:
        raise SystemExit(f"ERROR: Capacitor output escapes workspace: {resolved}") from exc
    if relative != Path("dist") / "mobile" or output_dir.is_symlink():
        raise SystemExit(f"ERROR: refusing to replace unexpected Capacitor output: {resolved}")
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)
    target = output_dir / "index.html"
    target.write_text(html, encoding="utf-8", newline="\n")
    return target


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
    native_index = stage_capacitor_html(html)
    print(f"Mobile V2 dist written: {DIST_INDEX.relative_to(ROOT)} ({DIST_INDEX.stat().st_size:,} bytes)")
    print(f"Capacitor input written: {native_index.relative_to(ROOT)} ({native_index.stat().st_size:,} bytes)")
    print("Mobile bundle uses Canvas 2D + raw WebGL E8 chords/Quasicrystal/SDF, inlined E8 data, and no PWA service worker.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
