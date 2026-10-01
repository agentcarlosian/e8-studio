#!/usr/bin/env python3
"""Build one portable desktop HTML file from the Vite ESM graph."""
from __future__ import annotations

from pathlib import Path

from build_desktop_inline import write_share_html

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "e8-studio.html"


def main() -> int:
    write_share_html(OUT)
    html = OUT.read_text(encoding="utf-8")
    blocked = ('src="src/', 'href="src/', 'https://cdn.jsdelivr.net',
               'https://fonts.googleapis.com', 'serviceWorker',
               'manifest.webmanifest', 'dist/e8-studio.html')
    hits = [marker for marker in blocked if marker in html]
    if hits:
        raise SystemExit(f"ERROR: share HTML has external dependency or redirect markers: {hits}")
    print(f"Desktop share file written: {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
